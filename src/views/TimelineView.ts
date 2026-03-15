import { ItemView, WorkspaceLeaf, TFile, Notice, debounce } from "obsidian";
import {
  ChronosSettings,
  TimelineNote,
  ZoomLevel,
  ViewMode,
  SwimlaneGroup,
  ZOOM_PX_PER_DAY,
  ZOOM_ORDER,
  DATE_PAD_DAYS,
  LANE_HEIGHT_PX,
  SWIMLANE_HEADER_HEIGHT,
  VIRT_BUFFER_PX,
} from "../types";
import {
  loadNotes,
  assignLanes,
  buildSwimlaneGroups,
  expandWithRecurring,
} from "../utils/noteLoader";
import { updateNoteDate, formatDateForFrontmatter } from "../utils/frontmatterEditor";
import { createNoteCard } from "../components/NoteCard";
import { FilterPanel, ActiveFilters, matchesFilters, createEmptyFilters } from "../components/FilterPanel";
import { Minimap } from "../components/Minimap";
import { HeatmapRenderer } from "./HeatmapRenderer";
import { CreateNoteModal } from "../components/CreateNoteModal";
import { PreviewPanel } from "../components/PreviewPanel";
import { exportTimelineAsPng } from "../utils/exportUtils";
import { getDataviewApi } from "../utils/dataviewIntegration";

export const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

const FILTER_PERSIST_KEY = "chronos-timeline-filters";

export class TimelineView extends ItemView {
  private settings: ChronosSettings;
  private allNotes: TimelineNote[] = [];
  private filteredNotes: TimelineNote[] = [];

  private zoom: ZoomLevel;
  private viewMode: ViewMode = "timeline";
  private viewStartDate: Date = new Date();
  private viewEndDate: Date = new Date();
  private totalWidth = 0;
  private trackHeight = 0;
  private _cachedSwimlaneGroups: SwimlaneGroup[] = [];

  private filterPanel: FilterPanel | null = null;
  private minimap: Minimap | null = null;
  private heatmapRenderer: HeatmapRenderer | null = null;
  private previewPanel: PreviewPanel | null = null;
  private activeFilters: ActiveFilters = createEmptyFilters();

  // DOM
  private toolbarEl: HTMLElement | null = null;
  private mainAreaEl: HTMLElement | null = null;
  private filterPanelWrapper: HTMLElement | null = null;
  private contentAreaEl: HTMLElement | null = null;
  private previewPanelWrapper: HTMLElement | null = null;
  private scrollWrapper: HTMLElement | null = null;
  private axisEl: HTMLElement | null = null;
  private trackEl: HTMLElement | null = null;
  private cardsLayerEl: HTMLElement | null = null;
  private heatmapAreaEl: HTMLElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private counterEl: HTMLElement | null = null;
  private legendEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private zoomBtns: Map<ZoomLevel, HTMLButtonElement> = new Map();
  private modeBtns: Map<ViewMode, HTMLButtonElement> = new Map();
  private exportBtn: HTMLButtonElement | null = null;

  // Drag state
  private draggedNote: TimelineNote | null = null;

  constructor(leaf: WorkspaceLeaf, settings: ChronosSettings) {
    super(leaf);
    this.settings = settings;
    this.zoom = settings.defaultZoom;
  }

  getViewType(): string { return TIMELINE_VIEW_TYPE; }
  getDisplayText(): string { return "Chronos Timeline"; }
  getIcon(): string { return "calendar-range"; }

  async onOpen(): Promise<void> {
    this.buildDOM();
    this.loadAndRender();

    const debouncedReload = debounce(() => this.loadAndRender(), 800, true);
    this.registerEvent(this.app.vault.on("modify", debouncedReload));
    this.registerEvent(this.app.vault.on("create", debouncedReload));
    this.registerEvent(this.app.vault.on("delete", debouncedReload));
    this.registerEvent(this.app.metadataCache.on("changed", debouncedReload));

    // Keyboard shortcuts on the container element
    this.registerDomEvent(this.containerEl, "keydown", (evt: KeyboardEvent) => {
      if ((evt.target as HTMLElement).tagName === "INPUT") return;
      switch (evt.key) {
        case "+":
        case "=":
          evt.preventDefault();
          this.zoomIn();
          break;
        case "-":
          evt.preventDefault();
          this.zoomOut();
          break;
        case "t":
        case "T":
          evt.preventDefault();
          this.jumpToToday();
          break;
        case "f":
        case "F":
          evt.preventDefault();
          this.toggleFilterPanel();
          break;
        case "h":
        case "H":
          evt.preventDefault();
          this.toggleViewMode();
          break;
        case "e":
        case "E":
          evt.preventDefault();
          this.handleExport();
          break;
      }
    });

    // Make container focusable for keyboard events
    this.containerEl.setAttribute("tabindex", "0");
  }

  async onClose(): Promise<void> {
    this.previewPanel?.unload();
    this.containerEl.empty();
  }

  // ---------------------------------------------------------------------------
  // DOM Construction
  // ---------------------------------------------------------------------------

  private buildDOM(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("chronos-container");

    this.toolbarEl = container.createDiv({ cls: "chronos-toolbar" });
    this.buildToolbar(this.toolbarEl);

    this.mainAreaEl = container.createDiv({ cls: "chronos-main-area" });

    // Filter panel (hidden by default)
    this.filterPanelWrapper = this.mainAreaEl.createDiv({
      cls: "chronos-filter-panel-wrapper chronos-hidden",
    });
    const persistKey = this.settings.persistFilters ? FILTER_PERSIST_KEY : undefined;
    this.filterPanel = new FilterPanel(
      this.filterPanelWrapper,
      (filters) => {
        this.activeFilters = filters;
        this.applyFiltersAndRender();
      },
      persistKey
    );

    // Restore persisted filters
    if (this.settings.persistFilters) {
      this.activeFilters = this.filterPanel.getFilters();
    }

    // Content area (holds scroll wrapper + heatmap + minimap)
    this.contentAreaEl = this.mainAreaEl.createDiv({ cls: "chronos-content-area" });

    // Timeline scroll wrapper
    this.scrollWrapper = this.contentAreaEl.createDiv({ cls: "chronos-scroll-wrapper" });

    // Loading overlay
    this.loadingOverlay = this.scrollWrapper.createDiv({ cls: "chronos-loading-overlay chronos-hidden" });
    this.loadingOverlay.createDiv({ cls: "chronos-spinner" });

    // Sticky axis header
    this.axisEl = this.scrollWrapper.createDiv({ cls: "chronos-axis" });

    // Track (note cards)
    this.trackEl = this.scrollWrapper.createDiv({ cls: "chronos-track" });
    this.cardsLayerEl = this.trackEl.createDiv({ cls: "chronos-cards-layer" });

    this.registerDragDropOnTrack();

    this.trackEl.addEventListener("dblclick", (evt) => {
      const target = evt.target as HTMLElement;
      if (
        target.classList.contains("chronos-track") ||
        target.classList.contains("chronos-cards-layer") ||
        target.classList.contains("chronos-today-line") ||
        target.classList.contains("chronos-swimlane-bg")
      ) {
        this.handleTrackDoubleClick(evt);
      }
    });

    this.trackEl.addEventListener("click", (evt) => {
      if (
        (evt.target as HTMLElement) === this.trackEl ||
        (evt.target as HTMLElement) === this.cardsLayerEl
      ) {
        this.clearCardSelection();
      }
    });

    // Heatmap area (hidden by default)
    this.heatmapAreaEl = this.contentAreaEl.createDiv({ cls: "chronos-heatmap-area chronos-hidden" });
    this.heatmapRenderer = new HeatmapRenderer(this.heatmapAreaEl, (date) => {
      this.setViewMode("timeline");
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      if (this.filterPanel) {
        this.filterPanel.setDateRange(new Date(date), nextDay);
        this.activeFilters = this.filterPanel.getFilters();
      } else {
        this.activeFilters.dateFrom = new Date(date);
        this.activeFilters.dateTo = nextDay;
      }
      this.applyFiltersAndRender();
    });

    // Minimap
    if (this.settings.enableMinimap) {
      this.minimap = new Minimap(this.contentAreaEl, (scrollX) => {
        if (this.scrollWrapper) this.scrollWrapper.scrollLeft = scrollX;
      });
    }

    // Preview panel (right side)
    if (this.settings.enablePreviewPanel) {
      this.previewPanelWrapper = this.mainAreaEl.createDiv({ cls: "chronos-preview-panel-wrapper" });
      this.previewPanel = new PreviewPanel(this.previewPanelWrapper, () => {
        this.previewPanelWrapper?.addClass("chronos-hidden");
      });
      this.addChild(this.previewPanel);
    }

    // Scroll listener for virtualization and minimap
    this.scrollWrapper.addEventListener(
      "scroll",
      debounce(() => this.onScroll(), 40, true)
    );
  }

  private buildToolbar(toolbar: HTMLElement): void {
    // View mode toggle
    const modeGroup = toolbar.createDiv({ cls: "chronos-toolbar-group" });
    (["timeline", "heatmap"] as ViewMode[]).forEach((mode) => {
      const btn = modeGroup.createEl("button", {
        cls: `chronos-zoom-btn ${this.viewMode === mode ? "chronos-active" : ""}`,
        text: mode === "timeline" ? "Timeline" : "Heatmap",
      }) as HTMLButtonElement;
      btn.addEventListener("click", () => this.setViewMode(mode));
      this.modeBtns.set(mode, btn);
    });

    // Divider
    toolbar.createDiv({ cls: "chronos-toolbar-divider" });

    // Zoom controls
    const zoomGroup = toolbar.createDiv({ cls: "chronos-toolbar-group" });
    zoomGroup.createSpan({ cls: "chronos-toolbar-label", text: "Zoom:" });

    (["year", "month", "week", "day"] as ZoomLevel[]).forEach((level) => {
      const label = level.charAt(0).toUpperCase() + level.slice(1);
      const btn = zoomGroup.createEl("button", {
        cls: `chronos-zoom-btn ${this.zoom === level ? "chronos-active" : ""}`,
        text: label,
      }) as HTMLButtonElement;
      btn.dataset.zoom = level;
      btn.addEventListener("click", () => this.setZoom(level));
      this.zoomBtns.set(level, btn);
    });

    // Divider
    toolbar.createDiv({ cls: "chronos-toolbar-divider" });

    // Search input (always visible in toolbar)
    const searchGroup = toolbar.createDiv({ cls: "chronos-toolbar-group" });
    this.searchInputEl = searchGroup.createEl("input", {
      type: "text",
      placeholder: "Search…",
      cls: "chronos-toolbar-search",
    }) as HTMLInputElement;
    const SEARCH_DEBOUNCE_MS = 150;
    this.searchInputEl.addEventListener("input", debounce(() => {
      this.activeFilters.searchQuery = this.searchInputEl!.value.trim();
      this.filterPanel?.setSearchQuery(this.activeFilters.searchQuery);
      this.applyFiltersAndRender();
    }, SEARCH_DEBOUNCE_MS, true));

    // Jump-to-date input
    const jumpInput = searchGroup.createEl("input", {
      type: "date",
      cls: "chronos-toolbar-jump",
      title: "Jump to date",
    }) as HTMLInputElement;
    jumpInput.addEventListener("change", () => {
      if (jumpInput.value) {
        this.jumpToDate(new Date(jumpInput.value));
        // Reset value so the same date can be re-selected
        setTimeout(() => { jumpInput.value = ""; }, 300);
      }
    });

    // Center: Today + counter
    const centerGroup = toolbar.createDiv({ cls: "chronos-toolbar-group chronos-toolbar-center" });
    centerGroup.createEl("button", { cls: "chronos-btn", text: "Today" })
      .addEventListener("click", () => this.jumpToToday());
    this.counterEl = centerGroup.createDiv({ cls: "chronos-counter" });

    // Right: filter toggle + reset + export
    const rightGroup = toolbar.createDiv({ cls: "chronos-toolbar-group chronos-toolbar-right" });
    rightGroup.createEl("button", { cls: "chronos-btn", text: "Filters" })
      .addEventListener("click", () => this.toggleFilterPanel());
    rightGroup.createEl("button", { cls: "chronos-btn", text: "Reset" })
      .addEventListener("click", () => {
        this.filterPanel?.resetFilters();
        if (this.searchInputEl) this.searchInputEl.value = "";
        this.activeFilters = createEmptyFilters();
        this.applyFiltersAndRender();
      });
    this.exportBtn = rightGroup.createEl("button", { cls: "chronos-btn", text: "Export" }) as HTMLButtonElement;
    this.exportBtn.addEventListener("click", () => this.handleExport());
  }

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  private loadAndRender(): void {
    this.showLoading();
    setTimeout(() => {
      const dvApi = getDataviewApi(this.app);
      this.allNotes = loadNotes(this.app, this.settings, dvApi ?? undefined);
      this.filterPanel?.rebuildTagsAndFolders(this.allNotes);
      this.applyFiltersAndRender();
      this.hideLoading();
    }, 0);
  }

  private applyFiltersAndRender(): void {
    this.filteredNotes = this.allNotes.filter((n) => matchesFilters(n, this.activeFilters));
    this.render();
    if (this.hasActiveFilters() && this.viewMode === "timeline" && this.filteredNotes.length > 0) {
      this.scrollToFitNotes();
    }
  }

  private hasActiveFilters(): boolean {
    const f = this.activeFilters;
    return (
      f.tags.size > 0 ||
      f.folders.size > 0 ||
      f.searchQuery !== "" ||
      f.dateFrom !== null ||
      f.dateTo !== null
    );
  }

  private scrollToFitNotes(): void {
    if (!this.scrollWrapper || this.filteredNotes.length === 0) return;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const times = this.filteredNotes.map((n) => n.date.getTime());
    const midMs = (Math.min(...times) + Math.max(...times)) / 2;
    const midDays = (midMs - this.viewStartDate.getTime()) / 86_400_000;
    const x = midDays * pxPerDay - this.scrollWrapper.clientWidth / 2;
    this.scrollWrapper.scrollLeft = Math.max(0, x);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    if (this.viewMode === "heatmap") {
      this.heatmapRenderer?.render(this.filteredNotes);
      this.updateCounter(this.filteredNotes.length, this.allNotes.length);
      return;
    }
    this.renderTimeline();
  }

  private renderTimeline(): void {
    if (!this.axisEl || !this.trackEl || !this.cardsLayerEl) return;

    this.axisEl.empty();
    this.trackEl
      .querySelectorAll(".chronos-swimlane-bg, .chronos-swimlane-header, .chronos-today-line")
      .forEach((el) => el.remove());
    this.cardsLayerEl.empty();
    this.legendEl?.remove();
    this.legendEl = null;

    if (this.filteredNotes.length === 0) {
      this.trackEl.createDiv({
        cls: "chronos-empty-state",
        text: "No notes found. Add a date field to frontmatter (e.g. date: 2024-01-15) or adjust filters.",
      });
      this.updateCounter(0, this.allNotes.length);
      return;
    }

    this.computeDateRange();

    // Expand recurring notes within the visible range (with cache)
    const cacheStart = this.viewStartDate.getTime();
    const cacheEnd = this.viewEndDate.getTime();
    const cacheCount = this.filteredNotes.length;
    let displayNotes: TimelineNote[];
    if (
      this._recurringCache &&
      this._recurringCache.start === cacheStart &&
      this._recurringCache.end === cacheEnd &&
      this._recurringCache.count === cacheCount
    ) {
      displayNotes = this._recurringCache.result;
    } else {
      displayNotes = expandWithRecurring(
        this.filteredNotes,
        this.app,
        this.settings,
        this.viewStartDate,
        this.viewEndDate
      );
      this._recurringCache = { start: cacheStart, end: cacheEnd, count: cacheCount, result: displayNotes };
    }

    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const totalDays = Math.ceil(
      (this.viewEndDate.getTime() - this.viewStartDate.getTime()) / 86_400_000
    );
    this.totalWidth = Math.max(totalDays * pxPerDay, 800);

    this.axisEl.style.width = `${this.totalWidth}px`;
    this.renderAxis(pxPerDay);

    if (this.settings.enableSwimlanes) {
      const groups = buildSwimlaneGroups(
        displayNotes,
        this.viewStartDate,
        this.zoom,
        this.settings.cardWidth,
        this.settings.maxLanes
      );
      this._cachedSwimlaneGroups = groups;
      this.trackHeight = groups.reduce((sum, g) => sum + g.height, 0) + 24;
      this.renderSwimlanes(groups, pxPerDay);
    } else {
      this._cachedSwimlaneGroups = [];
      assignLanes(
        displayNotes,
        this.viewStartDate,
        this.zoom,
        this.settings.cardWidth,
        this.settings.maxLanes
      );
      const maxLane = Math.max(...displayNotes.map((n) => n.laneIndex), 0);
      this.trackHeight = (maxLane + 1) * LANE_HEIGHT_PX + 24;
    }

    this.trackEl.style.width = `${this.totalWidth}px`;
    this.trackEl.style.height = `${this.trackHeight}px`;
    this.cardsLayerEl.style.width = `${this.totalWidth}px`;
    this.cardsLayerEl.style.height = `${this.trackHeight}px`;

    // Today line
    const todayOffDays = (Date.now() - this.viewStartDate.getTime()) / 86_400_000;
    const todayX = todayOffDays * pxPerDay;
    if (todayX >= 0) {
      const todayLine = this.trackEl.createDiv({ cls: "chronos-today-line" });
      todayLine.style.left = `${todayX}px`;
      todayLine.style.height = `${this.trackHeight}px`;
    }

    // Store display notes for card rendering
    this._displayNotes = displayNotes;
    this.renderVisibleCards();
    this.updateCounter(this.filteredNotes.length, this.allNotes.length);

    if (this.minimap && this.scrollWrapper) {
      this.minimap.update(
        displayNotes,
        this.viewStartDate,
        this.zoom,
        this.totalWidth,
        this.scrollWrapper.scrollLeft,
        this.scrollWrapper.clientWidth
      );
    }

    // Color legend
    if (this.settings.showColorLegend) {
      this.renderColorLegend(displayNotes);
    }

    this.jumpToToday();
  }

  // Scratch storage for the display notes between render and renderVisibleCards calls
  private _displayNotes: TimelineNote[] = [];

  // Cache for expandWithRecurring
  private _recurringCache: { start: number; end: number; count: number; result: TimelineNote[] } | null = null;

  private renderSwimlanes(groups: SwimlaneGroup[], _pxPerDay: number): void {
    for (const group of groups) {
      const bg = this.trackEl!.createDiv({ cls: "chronos-swimlane-bg" });
      bg.style.top = `${group.yOffset}px`;
      bg.style.height = `${group.height}px`;
      bg.style.width = `${this.totalWidth}px`;

      const header = this.trackEl!.createDiv({ cls: "chronos-swimlane-header" });
      header.style.top = `${group.yOffset}px`;
      header.style.width = `${this.totalWidth}px`;
      const labelEl = header.createSpan({ cls: "chronos-swimlane-label", text: group.label });
      labelEl.title = group.label;
      // Note count badge
      header.createSpan({
        cls: "chronos-swimlane-count",
        text: `${group.notes.length}`,
      });
    }
  }

  private renderVisibleCards(): void {
    if (!this.cardsLayerEl || !this.scrollWrapper) return;

    this.cardsLayerEl.empty();

    const displayNotes = this._displayNotes;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const useVirt = this.settings.enableVirtualization && displayNotes.length > 150;

    let visStart = 0;
    let visEnd = this.totalWidth;

    if (useVirt) {
      visStart = this.scrollWrapper.scrollLeft - VIRT_BUFFER_PX;
      visEnd = this.scrollWrapper.scrollLeft + this.scrollWrapper.clientWidth + VIRT_BUFFER_PX;
    }

    const yOffsetMap = this.buildYOffsetMap(displayNotes);

    for (const note of displayNotes) {
      const offsetDays = (note.date.getTime() - this.viewStartDate.getTime()) / 86_400_000;
      const xPx = offsetDays * pxPerDay;

      // Gantt: compute actual card width based on endDate
      let cardW = this.settings.cardWidth;
      if (note.endDate) {
        const endOffsetDays = (note.endDate.getTime() - this.viewStartDate.getTime()) / 86_400_000;
        cardW = Math.max((endOffsetDays - offsetDays) * pxPerDay, this.settings.cardWidth);
      }

      if (useVirt && (xPx + cardW < visStart || xPx > visEnd)) continue;

      const yOffset = yOffsetMap.get(note.path + note.date.getTime()) ?? 0;

      const card = createNoteCard(
        note,
        xPx,
        yOffset,
        cardW,
        (n, evt) => this.selectCard(n, evt),
        (n, evt) => this.openNote(n, evt),
        (n, target, evt) => this.showHoverPreview(n, target, evt),
        (n, evt) => this.onDragStart(n, evt),
        this.settings.showRelativeDates,
        (n, deltaX) => this.onTouchDrag(n, deltaX)
      );
      this.cardsLayerEl.appendChild(card);
    }
  }

  private buildYOffsetMap(displayNotes: TimelineNote[]): Map<string, number> {
    const map = new Map<string, number>();
    if (!this.settings.enableSwimlanes || this._cachedSwimlaneGroups.length === 0) {
      for (const note of displayNotes) {
        map.set(note.path + note.date.getTime(), 0);
      }
      return map;
    }

    for (const group of this._cachedSwimlaneGroups) {
      for (const note of group.notes) {
        map.set(note.path + note.date.getTime(), group.yOffset + SWIMLANE_HEADER_HEIGHT);
      }
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // Color Legend
  // ---------------------------------------------------------------------------

  private renderColorLegend(notes: TimelineNote[]): void {
    if (!this.scrollWrapper) return;

    // Build unique color → label map
    const entries = new Map<string, string>();
    for (const note of notes) {
      if (note.isRecurring) continue;
      const key = this.settings.colorBy === "folder" ? note.topLevelFolder
        : this.settings.colorBy === "tag" ? (note.tags[0] ?? "")
        : "";
      if (key && !entries.has(note.color)) {
        entries.set(note.color, key);
      }
    }

    if (entries.size === 0) return;

    this.legendEl = this.scrollWrapper.createDiv({ cls: "chronos-legend" });
    for (const [color, label] of entries) {
      const item = this.legendEl.createDiv({ cls: "chronos-legend-item" });
      const dot = item.createDiv({ cls: "chronos-legend-dot" });
      dot.style.backgroundColor = color;
      item.createSpan({ cls: "chronos-legend-label", text: label });
    }
  }

  // ---------------------------------------------------------------------------
  // Axis
  // ---------------------------------------------------------------------------

  private renderAxis(pxPerDay: number): void {
    if (!this.axisEl) return;
    const markers = this.computeAxisMarkers(pxPerDay);
    for (const m of markers) {
      const el = this.axisEl.createDiv({ cls: `chronos-axis-marker chronos-axis-${m.type}` });
      el.style.left = `${m.xPx}px`;
      el.createSpan({ text: m.label });
    }
  }

  private computeAxisMarkers(
    pxPerDay: number
  ): Array<{ xPx: number; label: string; type: string }> {
    const markers: Array<{ xPx: number; label: string; type: string }> = [];
    const start = this.viewStartDate;
    const end = this.viewEndDate;
    const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    if (this.zoom === "year" || this.zoom === "month") {
      let cur = new Date(start.getFullYear(), 0, 1);
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        markers.push({ xPx, label: String(cur.getFullYear()), type: "year" });
        cur = new Date(cur.getFullYear() + 1, 0, 1);
      }
    }

    if (this.zoom === "month" || this.zoom === "week") {
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        const label = this.zoom === "week"
          ? `${mn[cur.getMonth()]} ${cur.getFullYear()}`
          : mn[cur.getMonth()];
        markers.push({ xPx, label, type: "month" });
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    }

    if (this.zoom === "week") {
      let cur = new Date(start);
      cur.setDate(cur.getDate() + ((1 - cur.getDay() + 7) % 7));
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        markers.push({ xPx, label: `W${isoWeek(cur)}`, type: "week" });
        cur = new Date(cur.getTime() + 7 * 86_400_000);
      }
    }

    if (this.zoom === "day") {
      let cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        markers.push({ xPx, label: `${mn[cur.getMonth()]} ${cur.getDate()}`, type: "day" });
        cur = new Date(cur.getTime() + 86_400_000);
      }
    }

    return markers;
  }

  // ---------------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------------

  private selectCard(note: TimelineNote, _evt: MouseEvent): void {
    this.clearCardSelection();
    const card = this.cardsLayerEl?.querySelector(
      `[data-path="${CSS.escape(note.path)}"]`
    );
    card?.addClass("chronos-card-selected");

    // Minimap highlight
    this.minimap?.setSelectedNote(note.path);

    // Preview panel
    if (this.settings.enablePreviewPanel && this.previewPanel) {
      this.previewPanel.showNote(this.app, note.path);
    }
  }

  private openNote(note: TimelineNote, evt: MouseEvent): void {
    this.clearCardSelection();
    const file = this.app.vault.getAbstractFileByPath(note.path);
    if (file instanceof TFile) {
      const newTab = evt.ctrlKey || evt.metaKey;
      this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(file);
    }
  }

  private showHoverPreview(note: TimelineNote, target: HTMLElement, evt: MouseEvent): void {
    if (!this.settings.showPreviewTooltip) return;
    this.app.workspace.trigger("hover-link", {
      event: evt,
      source: TIMELINE_VIEW_TYPE,
      hoverParent: this,
      targetEl: target,
      linktext: note.path,
    });
  }

  private clearCardSelection(): void {
    this.cardsLayerEl?.querySelectorAll(".chronos-card-selected").forEach((el) =>
      el.removeClass("chronos-card-selected")
    );
  }

  private handleTrackDoubleClick(evt: MouseEvent): void {
    if (!this.scrollWrapper) return;
    const scrollLeft = this.scrollWrapper.scrollLeft;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const clickXInTrack = (evt.target as HTMLElement).classList.contains("chronos-cards-layer")
      ? (evt as MouseEvent).offsetX
      : scrollLeft + (evt as MouseEvent).clientX -
        this.scrollWrapper.getBoundingClientRect().left;

    const ms = this.viewStartDate.getTime() + (clickXInTrack / pxPerDay) * 86_400_000;
    new CreateNoteModal(this.app, new Date(ms), this.settings, (file) => {
      this.app.workspace.getLeaf(false).openFile(file);
    }).open();
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  private handleExport(): void {
    if (this.filteredNotes.length === 0) {
      new Notice("No notes to export.");
      return;
    }
    const btn = this.exportBtn;
    if (btn) { btn.textContent = "Exporting\u2026"; btn.disabled = true; }
    const isDark = document.body.classList.contains("theme-dark");
    try {
      exportTimelineAsPng(
        this._displayNotes,
        this.viewStartDate,
        this.zoom,
        this.totalWidth,
        this.trackHeight,
        this.settings.cardWidth,
        isDark
      );
      new Notice("Timeline exported as PNG.");
    } catch (e) {
      new Notice(`Export failed: ${(e as Error).message}`);
    } finally {
      if (btn) { btn.textContent = "Export"; btn.disabled = false; }
    }
  }

  // ---------------------------------------------------------------------------
  // Drag to reschedule (mouse)
  // ---------------------------------------------------------------------------

  private onDragStart(note: TimelineNote, evt: DragEvent): void {
    if (note.isRecurring) return; // Can't reschedule ghost copies
    this.draggedNote = note;
    evt.dataTransfer?.setData("text/plain", note.path);
    this.trackEl?.addClass("chronos-drag-over");
  }

  private registerDragDropOnTrack(): void {
    if (!this.trackEl) return;

    this.trackEl.addEventListener("dragover", (evt) => {
      if (!this.draggedNote) return;
      evt.preventDefault();
      if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
    });

    this.trackEl.addEventListener("dragleave", () => {
      this.trackEl?.removeClass("chronos-drag-over");
    });

    this.trackEl.addEventListener("drop", async (evt) => {
      evt.preventDefault();
      this.trackEl?.removeClass("chronos-drag-over");
      if (!this.draggedNote || !this.settings.enableDragReschedule) return;

      const scrollLeft = this.scrollWrapper?.scrollLeft ?? 0;
      const trackRect = this.trackEl!.getBoundingClientRect();
      const dropX = evt.clientX - trackRect.left + scrollLeft;
      const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
      const newDate = new Date(
        this.viewStartDate.getTime() + (dropX / pxPerDay) * 86_400_000
      );

      const file = this.app.vault.getAbstractFileByPath(this.draggedNote.path);
      if (file instanceof TFile) {
        const field =
          this.draggedNote.dateFieldUsed === "ctime"
            ? (this.settings.dateFields[0] ?? "date")
            : this.draggedNote.dateFieldUsed;
        try {
          await updateNoteDate(this.app, file, field, newDate);
          new Notice(`Rescheduled to ${formatDateForFrontmatter(newDate)}`);
        } catch (e) {
          new Notice(`Failed to reschedule: ${(e as Error).message}`);
        }
      }
      this.draggedNote = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Touch drag to reschedule (mobile)
  // ---------------------------------------------------------------------------

  private onTouchDrag(note: TimelineNote, deltaXPx: number): void {
    if (note.isRecurring || !this.settings.enableDragReschedule) return;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const deltaDays = deltaXPx / pxPerDay;
    const newDate = new Date(note.date.getTime() + deltaDays * 86_400_000);

    const file = this.app.vault.getAbstractFileByPath(note.path);
    if (file instanceof TFile) {
      const field =
        note.dateFieldUsed === "ctime"
          ? (this.settings.dateFields[0] ?? "date")
          : note.dateFieldUsed;
      updateNoteDate(this.app, file, field, newDate)
        .then(() => new Notice(`Rescheduled to ${formatDateForFrontmatter(newDate)}`))
        .catch((e: Error) => new Notice(`Failed: ${e.message}`));
    }
  }

  // ---------------------------------------------------------------------------
  // Scroll & virtualization
  // ---------------------------------------------------------------------------

  private onScroll(): void {
    if (
      this.settings.enableVirtualization &&
      this._displayNotes.length > 150 &&
      this.viewMode === "timeline"
    ) {
      this.renderVisibleCards();
    }

    if (this.minimap && this.scrollWrapper) {
      this.minimap.update(
        this._displayNotes,
        this.viewStartDate,
        this.zoom,
        this.totalWidth,
        this.scrollWrapper.scrollLeft,
        this.scrollWrapper.clientWidth
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  jumpToToday(): void {
    if (!this.scrollWrapper) return;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const offsetDays = (Date.now() - this.viewStartDate.getTime()) / 86_400_000;
    const todayX = offsetDays * pxPerDay - this.scrollWrapper.clientWidth / 2;
    this.scrollWrapper.scrollLeft = Math.max(0, todayX);
  }

  private jumpToDate(date: Date): void {
    if (!this.scrollWrapper) return;
    if (date < this.viewStartDate || date > this.viewEndDate) {
      new Notice("Date is outside the current timeline range.");
      return;
    }
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const offsetDays = (date.getTime() - this.viewStartDate.getTime()) / 86_400_000;
    const x = offsetDays * pxPerDay - this.scrollWrapper.clientWidth / 2;
    this.scrollWrapper.scrollLeft = Math.max(0, x);
  }

  zoomIn(): void {
    const idx = ZOOM_ORDER.indexOf(this.zoom);
    if (idx < ZOOM_ORDER.length - 1) this.setZoom(ZOOM_ORDER[idx + 1]);
  }

  zoomOut(): void {
    const idx = ZOOM_ORDER.indexOf(this.zoom);
    if (idx > 0) this.setZoom(ZOOM_ORDER[idx - 1]);
  }

  // ---------------------------------------------------------------------------
  // View state changes
  // ---------------------------------------------------------------------------

  private setZoom(level: ZoomLevel): void {
    this.zoom = level;
    this.zoomBtns.forEach((btn, z) => btn.toggleClass("chronos-active", z === level));
    this.renderTimeline();
  }

  private setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.modeBtns.forEach((btn, m) => btn.toggleClass("chronos-active", m === mode));

    const isTimeline = mode === "timeline";
    this.scrollWrapper?.toggleClass("chronos-hidden", !isTimeline);
    this.heatmapAreaEl?.toggleClass("chronos-hidden", isTimeline);
    this.minimap?.getContainer().toggleClass("chronos-hidden", !isTimeline);
    this.zoomBtns.forEach((btn) => btn.toggleClass("chronos-btn-disabled", !isTimeline));

    this.render();
  }

  toggleViewMode(): void {
    this.setViewMode(this.viewMode === "timeline" ? "heatmap" : "timeline");
  }

  toggleFilterPanel(): void {
    this.filterPanelWrapper?.classList.toggle("chronos-hidden");
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private computeDateRange(): void {
    if (this.filteredNotes.length === 0) {
      const now = Date.now();
      this.viewStartDate = new Date(now - 365 * 86_400_000);
      this.viewEndDate = new Date(now + 365 * 86_400_000);
      return;
    }
    const times = this.filteredNotes.map((n) => n.date.getTime());
    const minMs = Math.min(...times);
    const maxMs = Math.max(...times);
    const now = Date.now();

    this.viewStartDate = new Date(Math.min(minMs, now) - DATE_PAD_DAYS * 86_400_000);
    this.viewEndDate = new Date(Math.max(maxMs, now) + DATE_PAD_DAYS * 86_400_000);
  }

  private showLoading(): void {
    this.loadingOverlay?.removeClass("chronos-hidden");
  }

  private hideLoading(): void {
    this.loadingOverlay?.addClass("chronos-hidden");
  }

  private updateCounter(visible: number, total: number): void {
    if (this.counterEl) {
      this.counterEl.textContent =
        visible === total ? `${total} notes` : `${visible} / ${total} notes`;
    }
  }

  updateSettings(settings: ChronosSettings): void {
    this.settings = settings;
    this.zoom = settings.defaultZoom;
    this.loadAndRender();
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function isoWeek(d: Date): number {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const w1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(
    ((tmp.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7
  );
}
