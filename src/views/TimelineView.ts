import { App, ItemView, WorkspaceLeaf, TFile, Notice, debounce } from "obsidian";
import {
  ChronosSettings,
  TimelineNote,
  ZoomLevel,
  ViewMode,
  SwimlaneGroup,
  ZOOM_PX_PER_DAY,
  DATE_PAD_DAYS,
  LANE_HEIGHT_PX,
  SWIMLANE_HEADER_HEIGHT,
  VIRT_BUFFER_PX,
} from "../types";
import { loadNotes, assignLanes, buildSwimlaneGroups } from "../utils/noteLoader";
import { updateNoteDate, formatDateForFrontmatter } from "../utils/frontmatterEditor";
import { createNoteCard } from "../components/NoteCard";
import { FilterPanel, ActiveFilters, matchesFilters } from "../components/FilterPanel";
import { Minimap } from "../components/Minimap";
import { HeatmapRenderer } from "./HeatmapRenderer";
import { CreateNoteModal } from "../components/CreateNoteModal";

export const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

export class TimelineView extends ItemView {
  private settings: ChronosSettings;
  private allNotes: TimelineNote[] = [];
  private filteredNotes: TimelineNote[] = [];

  private zoom: ZoomLevel;
  private viewMode: ViewMode = "timeline";
  private viewStartDate: Date = new Date();
  private viewEndDate: Date = new Date();
  private totalWidth = 0;

  private filterPanel: FilterPanel | null = null;
  private minimap: Minimap | null = null;
  private heatmapRenderer: HeatmapRenderer | null = null;
  private activeFilters: ActiveFilters = {
    tags: new Set(),
    folders: new Set(),
    searchQuery: "",
    dateFrom: null,
    dateTo: null,
  };

  // DOM
  private toolbarEl: HTMLElement | null = null;
  private mainAreaEl: HTMLElement | null = null;
  private filterPanelWrapper: HTMLElement | null = null;
  private contentAreaEl: HTMLElement | null = null;
  private scrollWrapper: HTMLElement | null = null;
  private axisEl: HTMLElement | null = null;
  private trackEl: HTMLElement | null = null;
  private cardsLayerEl: HTMLElement | null = null;
  private heatmapAreaEl: HTMLElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private counterEl: HTMLElement | null = null;
  private zoomBtns: Map<ZoomLevel, HTMLButtonElement> = new Map();
  private modeBtns: Map<ViewMode, HTMLButtonElement> = new Map();

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
  }

  async onClose(): Promise<void> {
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
    this.filterPanel = new FilterPanel(this.filterPanelWrapper, (filters) => {
      this.activeFilters = filters;
      this.applyFiltersAndRender();
    });

    // Content area
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
      if ((evt.target as HTMLElement) === this.trackEl ||
          (evt.target as HTMLElement) === this.cardsLayerEl) {
        this.clearCardSelection();
      }
    });

    // Heatmap area (hidden by default)
    this.heatmapAreaEl = this.contentAreaEl.createDiv({ cls: "chronos-heatmap-area chronos-hidden" });
    this.heatmapRenderer = new HeatmapRenderer(this.heatmapAreaEl, (date, notes) => {
      // Switch to timeline and scroll to that day
      this.setViewMode("timeline");
      this.activeFilters.dateFrom = date;
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      this.activeFilters.dateTo = nextDay;
      this.filterPanel?.resetFilters();
      this.applyFiltersAndRender();
    });

    // Minimap
    if (this.settings.enableMinimap) {
      this.minimap = new Minimap(this.contentAreaEl, (scrollX) => {
        if (this.scrollWrapper) this.scrollWrapper.scrollLeft = scrollX;
      });
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

    // Zoom controls (only relevant for timeline mode)
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

    // Center: Today + counter
    const centerGroup = toolbar.createDiv({ cls: "chronos-toolbar-group chronos-toolbar-center" });
    centerGroup.createEl("button", { cls: "chronos-btn", text: "Today" })
      .addEventListener("click", () => this.scrollToToday());
    this.counterEl = centerGroup.createDiv({ cls: "chronos-counter" });

    // Right: filter toggle + reset
    const rightGroup = toolbar.createDiv({ cls: "chronos-toolbar-group chronos-toolbar-right" });
    rightGroup.createEl("button", { cls: "chronos-btn", text: "Filters" })
      .addEventListener("click", () => this.toggleFilterPanel());
    rightGroup.createEl("button", { cls: "chronos-btn", text: "Reset" })
      .addEventListener("click", () => this.filterPanel?.resetFilters());
  }

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  private loadAndRender(): void {
    this.showLoading();
    // Defer to next microtask so the spinner renders before the sync work
    setTimeout(() => {
      this.allNotes = loadNotes(this.app, this.settings);
      this.filterPanel?.rebuildTagsAndFolders(this.allNotes);
      this.applyFiltersAndRender();
      this.hideLoading();
    }, 0);
  }

  private applyFiltersAndRender(): void {
    this.filteredNotes = this.allNotes.filter((n) => matchesFilters(n, this.activeFilters));
    this.render();
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
    this.trackEl.querySelectorAll(".chronos-swimlane-bg, .chronos-swimlane-header, .chronos-today-line")
      .forEach((el) => el.remove());
    this.cardsLayerEl.empty();

    if (this.filteredNotes.length === 0) {
      this.trackEl.createDiv({
        cls: "chronos-empty-state",
        text: "No notes found. Add a date field to frontmatter (e.g. date: 2024-01-15) or adjust filters.",
      });
      this.updateCounter(0, this.allNotes.length);
      return;
    }

    this.computeDateRange();
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const totalDays = Math.ceil(
      (this.viewEndDate.getTime() - this.viewStartDate.getTime()) / 86_400_000
    );
    this.totalWidth = Math.max(totalDays * pxPerDay, 800);

    this.axisEl.style.width = `${this.totalWidth}px`;
    this.renderAxis(pxPerDay);

    let trackHeight: number;

    if (this.settings.enableSwimlanes) {
      const groups = buildSwimlaneGroups(
        this.filteredNotes,
        this.viewStartDate,
        this.zoom,
        this.settings.cardWidth,
        this.settings.maxLanes
      );
      trackHeight = groups.reduce((sum, g) => sum + g.height, 0) + 24;
      this.renderSwimlanes(groups, pxPerDay);
    } else {
      assignLanes(
        this.filteredNotes,
        this.viewStartDate,
        this.zoom,
        this.settings.cardWidth,
        this.settings.maxLanes
      );
      const maxLane = Math.max(...this.filteredNotes.map((n) => n.laneIndex), 0);
      trackHeight = (maxLane + 1) * LANE_HEIGHT_PX + 24;
    }

    this.trackEl.style.width = `${this.totalWidth}px`;
    this.trackEl.style.height = `${trackHeight}px`;
    this.cardsLayerEl.style.width = `${this.totalWidth}px`;
    this.cardsLayerEl.style.height = `${trackHeight}px`;

    // Today line
    const todayOffDays = (Date.now() - this.viewStartDate.getTime()) / 86_400_000;
    const todayX = todayOffDays * pxPerDay;
    if (todayX >= 0) {
      const todayLine = this.trackEl.createDiv({ cls: "chronos-today-line" });
      todayLine.style.left = `${todayX}px`;
      todayLine.style.height = `${trackHeight}px`;
    }

    this.renderVisibleCards();
    this.updateCounter(this.filteredNotes.length, this.allNotes.length);

    // Minimap
    if (this.minimap && this.scrollWrapper) {
      this.minimap.update(
        this.filteredNotes,
        this.viewStartDate,
        this.zoom,
        this.totalWidth,
        this.scrollWrapper.scrollLeft,
        this.scrollWrapper.clientWidth
      );
    }

    this.scrollToToday();
  }

  private renderSwimlanes(groups: SwimlaneGroup[], pxPerDay: number): void {
    for (const group of groups) {
      // Background band
      const bg = this.trackEl!.createDiv({ cls: "chronos-swimlane-bg" });
      bg.style.top = `${group.yOffset}px`;
      bg.style.height = `${group.height}px`;
      bg.style.width = `${this.totalWidth}px`;

      // Header label
      const header = this.trackEl!.createDiv({ cls: "chronos-swimlane-header" });
      header.style.top = `${group.yOffset}px`;
      header.style.width = `${this.totalWidth}px`;
      header.createSpan({ cls: "chronos-swimlane-label", text: group.label });
    }
  }

  private renderVisibleCards(): void {
    if (!this.cardsLayerEl || !this.scrollWrapper) return;

    this.cardsLayerEl.empty();

    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const useVirt = this.settings.enableVirtualization && this.filteredNotes.length > 150;

    let visStart = 0;
    let visEnd = this.totalWidth;

    if (useVirt) {
      visStart = this.scrollWrapper.scrollLeft - VIRT_BUFFER_PX;
      visEnd = this.scrollWrapper.scrollLeft + this.scrollWrapper.clientWidth + VIRT_BUFFER_PX;
    }

    // Determine y-offset per note (swimlane mode offsets by group yOffset)
    const yOffsetMap = this.buildYOffsetMap();

    for (const note of this.filteredNotes) {
      const offsetDays = (note.date.getTime() - this.viewStartDate.getTime()) / 86_400_000;
      const xPx = offsetDays * pxPerDay;

      if (useVirt && (xPx + this.settings.cardWidth < visStart || xPx > visEnd)) continue;

      const yOffset = yOffsetMap.get(note.path) ?? 0;

      const card = createNoteCard(
        note,
        xPx,
        yOffset,
        this.settings.cardWidth,
        (n, evt) => this.selectCard(n, evt),
        (n, evt) => this.openNote(n, evt),
        (n, target, evt) => this.showHoverPreview(n, target, evt),
        (n, evt) => this.onDragStart(n, evt)
      );
      this.cardsLayerEl.appendChild(card);
    }
  }

  private buildYOffsetMap(): Map<string, number> {
    const map = new Map<string, number>();
    if (!this.settings.enableSwimlanes) {
      for (const note of this.filteredNotes) {
        map.set(note.path, 0);
      }
      return map;
    }

    // Rebuild swimlane groups to get yOffsets
    const groups = buildSwimlaneGroups(
      this.filteredNotes,
      this.viewStartDate,
      this.zoom,
      this.settings.cardWidth,
      this.settings.maxLanes
    );
    for (const group of groups) {
      for (const note of group.notes) {
        map.set(note.path, group.yOffset + SWIMLANE_HEADER_HEIGHT);
      }
    }
    return map;
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
    const card = this.cardsLayerEl?.querySelector(`[data-path="${CSS.escape(note.path)}"]`);
    card?.addClass("chronos-card-selected");
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
    // offsetX relative to the track (which may be wider than the viewport)
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
  // Drag to reschedule
  // ---------------------------------------------------------------------------

  private onDragStart(note: TimelineNote, evt: DragEvent): void {
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
        const field = this.draggedNote.dateFieldUsed === "ctime"
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
  // Scroll & virtualization
  // ---------------------------------------------------------------------------

  private onScroll(): void {
    if (
      this.settings.enableVirtualization &&
      this.filteredNotes.length > 150 &&
      this.viewMode === "timeline"
    ) {
      this.renderVisibleCards();
    }

    if (this.minimap && this.scrollWrapper) {
      this.minimap.update(
        this.filteredNotes,
        this.viewStartDate,
        this.zoom,
        this.totalWidth,
        this.scrollWrapper.scrollLeft,
        this.scrollWrapper.clientWidth
      );
    }
  }

  private scrollToToday(): void {
    if (!this.scrollWrapper) return;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const offsetDays = (Date.now() - this.viewStartDate.getTime()) / 86_400_000;
    const todayX = offsetDays * pxPerDay - this.scrollWrapper.clientWidth / 2;
    this.scrollWrapper.scrollLeft = Math.max(0, todayX);
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

    // Zoom buttons only relevant for timeline
    this.zoomBtns.forEach((btn) => btn.toggleClass("chronos-btn-disabled", !isTimeline));

    this.render();
  }

  private toggleFilterPanel(): void {
    this.filterPanelWrapper?.classList.toggle("chronos-hidden");
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private computeDateRange(): void {
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
      this.counterEl.textContent = visible === total
        ? `${total} notes`
        : `${visible} / ${total} notes`;
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
