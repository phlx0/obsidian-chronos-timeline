import { App, ItemView, WorkspaceLeaf, TFile, debounce } from "obsidian";
import { ChronosSettings, TimelineNote, ZoomLevel, ZOOM_PX_PER_DAY } from "../types";
import { loadNotes, assignLanes } from "../utils/noteLoader";
import { createNoteCard, LANE_HEIGHT_PX } from "../components/NoteCard";
import { FilterPanel, ActiveFilters, matchesFilters } from "../components/FilterPanel";

export const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

// Padding in days before the earliest note and after the latest note
const DATE_PAD_DAYS = 30;

export class TimelineView extends ItemView {
  private settings: ChronosSettings;
  private allNotes: TimelineNote[] = [];
  private filteredNotes: TimelineNote[] = [];

  private zoom: ZoomLevel;
  private viewStartDate: Date = new Date();
  private viewEndDate: Date = new Date();

  private filterPanel: FilterPanel | null = null;
  private activeFilters: ActiveFilters = {
    tags: new Set(),
    folders: new Set(),
    searchQuery: "",
    dateFrom: null,
    dateTo: null,
  };

  // DOM references
  private rootEl: HTMLElement | null = null;
  private toolbarEl: HTMLElement | null = null;
  private mainAreaEl: HTMLElement | null = null;
  private axisEl: HTMLElement | null = null;
  private trackEl: HTMLElement | null = null;
  private filterPanelEl: HTMLElement | null = null;

  private counterEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, settings: ChronosSettings) {
    super(leaf);
    this.settings = settings;
    this.zoom = settings.defaultZoom;
  }

  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Chronos Timeline";
  }

  getIcon(): string {
    return "calendar-range";
  }

  async onOpen(): Promise<void> {
    this.buildDOM();
    this.loadAndRender();

    // Re-render on vault changes (debounced to avoid thrashing)
    this.registerEvent(
      this.app.vault.on(
        "modify",
        debounce(() => this.loadAndRender(), 800, true)
      )
    );
    this.registerEvent(
      this.app.vault.on(
        "create",
        debounce(() => this.loadAndRender(), 800, true)
      )
    );
    this.registerEvent(
      this.app.vault.on(
        "delete",
        debounce(() => this.loadAndRender(), 800, true)
      )
    );
    this.registerEvent(
      this.app.metadataCache.on(
        "changed",
        debounce(() => this.loadAndRender(), 800, true)
      )
    );
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

    this.rootEl = container;

    // Toolbar
    this.toolbarEl = container.createDiv({ cls: "chronos-toolbar" });
    this.buildToolbar(this.toolbarEl);

    // Main area (filter panel + timeline)
    this.mainAreaEl = container.createDiv({ cls: "chronos-main-area" });

    // Filter panel (hidden by default)
    this.filterPanelEl = this.mainAreaEl.createDiv({ cls: "chronos-filter-panel-wrapper chronos-hidden" });
    this.filterPanel = new FilterPanel(this.filterPanelEl, (filters) => {
      this.activeFilters = filters;
      this.applyFiltersAndRender();
    });

    // Timeline scroll wrapper
    const scrollWrapper = this.mainAreaEl.createDiv({ cls: "chronos-scroll-wrapper" });

    // Sticky axis header
    this.axisEl = scrollWrapper.createDiv({ cls: "chronos-axis" });

    // Note track (scrollable content)
    this.trackEl = scrollWrapper.createDiv({ cls: "chronos-track" });

    // Click on background to deselect
    this.trackEl.addEventListener("click", (evt) => {
      if ((evt.target as HTMLElement).classList.contains("chronos-track")) {
        this.clearCardSelection();
      }
    });
  }

  private buildToolbar(toolbar: HTMLElement): void {
    // Left group: zoom controls
    const zoomGroup = toolbar.createDiv({ cls: "chronos-toolbar-group" });
    zoomGroup.createSpan({ cls: "chronos-toolbar-label", text: "Zoom:" });

    const zooms: { level: ZoomLevel; label: string }[] = [
      { level: "year", label: "Year" },
      { level: "month", label: "Month" },
      { level: "week", label: "Week" },
      { level: "day", label: "Day" },
    ];

    for (const z of zooms) {
      const btn = zoomGroup.createEl("button", {
        cls: `chronos-zoom-btn ${this.zoom === z.level ? "chronos-active" : ""}`,
        text: z.label,
      });
      btn.dataset.zoom = z.level;
      btn.addEventListener("click", () => this.setZoom(z.level));
    }

    // Center group: today button + counter
    const centerGroup = toolbar.createDiv({ cls: "chronos-toolbar-group chronos-toolbar-center" });
    const todayBtn = centerGroup.createEl("button", {
      cls: "chronos-btn",
      text: "Today",
    });
    todayBtn.addEventListener("click", () => this.scrollToToday());

    this.counterEl = centerGroup.createDiv({ cls: "chronos-counter" });

    // Right group: filter toggle
    const rightGroup = toolbar.createDiv({ cls: "chronos-toolbar-group chronos-toolbar-right" });
    const filterBtn = rightGroup.createEl("button", {
      cls: "chronos-btn",
      text: "Filters",
    });
    filterBtn.addEventListener("click", () => this.toggleFilterPanel());

    const resetBtn = rightGroup.createEl("button", {
      cls: "chronos-btn",
      text: "Reset",
    });
    resetBtn.addEventListener("click", () => {
      this.filterPanel?.resetFilters();
    });
  }

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  private loadAndRender(): void {
    this.allNotes = loadNotes(this.app, this.settings);
    this.filterPanel?.rebuildTagsAndFolders(this.allNotes);
    this.applyFiltersAndRender();
  }

  private applyFiltersAndRender(): void {
    this.filteredNotes = this.allNotes.filter((n) => matchesFilters(n, this.activeFilters));
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    if (!this.axisEl || !this.trackEl) return;

    this.axisEl.empty();
    this.trackEl.empty();

    if (this.filteredNotes.length === 0) {
      this.trackEl.createDiv({
        cls: "chronos-empty-state",
        text: "No notes found. Add a date field to your note frontmatter (e.g. date: 2024-01-15) or adjust filters.",
      });
      this.updateCounter(0, this.allNotes.length);
      return;
    }

    this.computeDateRange();
    const totalDays = Math.ceil(
      (this.viewEndDate.getTime() - this.viewStartDate.getTime()) / 86_400_000
    );
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const totalWidth = Math.max(totalDays * pxPerDay, 800);

    // Assign lanes to notes
    assignLanes(
      this.filteredNotes,
      this.viewStartDate,
      this.zoom,
      this.settings.cardWidth,
      this.settings.maxLanes
    );

    const maxLaneUsed = Math.max(...this.filteredNotes.map((n) => n.laneIndex), 0);
    const trackHeight = (maxLaneUsed + 1) * LANE_HEIGHT_PX + 24;

    // Render axis
    this.axisEl.style.width = `${totalWidth}px`;
    this.renderAxis(totalWidth, pxPerDay);

    // Render today line
    this.renderTodayLine(pxPerDay);

    // Render track and cards
    this.trackEl.style.width = `${totalWidth}px`;
    this.trackEl.style.height = `${trackHeight}px`;
    this.renderNoteCards();

    this.updateCounter(this.filteredNotes.length, this.allNotes.length);
    this.scrollToToday();
  }

  private computeDateRange(): void {
    const dates = this.filteredNotes.map((n) => n.date.getTime());
    const minMs = Math.min(...dates);
    const maxMs = Math.max(...dates);

    this.viewStartDate = new Date(minMs - DATE_PAD_DAYS * 86_400_000);
    this.viewEndDate = new Date(maxMs + DATE_PAD_DAYS * 86_400_000);

    // Always include today in the range
    const now = Date.now();
    if (now < this.viewStartDate.getTime()) {
      this.viewStartDate = new Date(now - DATE_PAD_DAYS * 86_400_000);
    }
    if (now > this.viewEndDate.getTime()) {
      this.viewEndDate = new Date(now + DATE_PAD_DAYS * 86_400_000);
    }
  }

  private renderAxis(totalWidthPx: number, pxPerDay: number): void {
    if (!this.axisEl) return;

    const markers = this.computeAxisMarkers(pxPerDay);
    for (const marker of markers) {
      const el = this.axisEl.createDiv({ cls: `chronos-axis-marker chronos-axis-${marker.type}` });
      el.style.left = `${marker.xPx}px`;
      el.createSpan({ text: marker.label });
    }
  }

  private computeAxisMarkers(
    pxPerDay: number
  ): Array<{ xPx: number; label: string; type: "year" | "month" | "week" | "day" }> {
    const markers: Array<{ xPx: number; label: string; type: "year" | "month" | "week" | "day" }> = [];
    const start = this.viewStartDate;
    const end = this.viewEndDate;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (this.zoom === "year" || this.zoom === "month") {
      // Year markers
      let cur = new Date(start.getFullYear(), 0, 1);
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        markers.push({ xPx, label: String(cur.getFullYear()), type: "year" });
        cur = new Date(cur.getFullYear() + 1, 0, 1);
      }
    }

    if (this.zoom === "month" || this.zoom === "week") {
      // Month markers
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        const label = this.zoom === "week"
          ? `${monthNames[cur.getMonth()]} ${cur.getFullYear()}`
          : monthNames[cur.getMonth()];
        markers.push({ xPx, label, type: "month" });
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    }

    if (this.zoom === "week") {
      // Week markers (every Monday)
      let cur = new Date(start);
      // Advance to next Monday
      cur.setDate(cur.getDate() + ((1 - cur.getDay() + 7) % 7));
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        const label = `W${getISOWeekNumber(cur)}`;
        markers.push({ xPx, label, type: "week" });
        cur = new Date(cur.getTime() + 7 * 86_400_000);
      }
    }

    if (this.zoom === "day") {
      // Day markers
      let cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      while (cur <= end) {
        const xPx = ((cur.getTime() - start.getTime()) / 86_400_000) * pxPerDay;
        const label = `${monthNames[cur.getMonth()]} ${cur.getDate()}`;
        markers.push({ xPx, label, type: "day" });
        cur = new Date(cur.getTime() + 86_400_000);
      }
    }

    return markers;
  }

  private renderTodayLine(pxPerDay: number): void {
    const now = new Date();
    const offsetDays = (now.getTime() - this.viewStartDate.getTime()) / 86_400_000;
    const xPx = offsetDays * pxPerDay;

    if (xPx < 0) return;

    const todayLine = this.trackEl!.createDiv({ cls: "chronos-today-line" });
    todayLine.style.left = `${xPx}px`;
    todayLine.setAttribute("aria-label", "Today");
  }

  private renderNoteCards(): void {
    if (!this.trackEl) return;
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];

    for (const note of this.filteredNotes) {
      const offsetDays = (note.date.getTime() - this.viewStartDate.getTime()) / 86_400_000;
      const xPx = offsetDays * pxPerDay;

      const card = createNoteCard(
        note,
        xPx,
        this.settings.cardWidth,
        (n, evt) => this.openNote(n, evt),
        (n, target, evt) => this.showHoverPreview(n, target, evt)
      );

      this.trackEl.appendChild(card);
    }
  }

  // ---------------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------------

  private openNote(note: TimelineNote, evt: MouseEvent): void {
    this.clearCardSelection();
    const card = this.trackEl?.querySelector(`[data-path="${CSS.escape(note.path)}"]`);
    card?.addClass("chronos-card-selected");

    const file = this.app.vault.getAbstractFileByPath(note.path);
    if (file instanceof TFile) {
      const newLeaf = evt.ctrlKey || evt.metaKey;
      this.app.workspace.getLeaf(newLeaf ? "tab" : false).openFile(file);
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
    this.trackEl?.querySelectorAll(".chronos-card-selected").forEach((el) => {
      el.removeClass("chronos-card-selected");
    });
  }

  private scrollToToday(): void {
    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const now = new Date();
    const offsetDays = (now.getTime() - this.viewStartDate.getTime()) / 86_400_000;
    const todayX = offsetDays * pxPerDay;

    const scrollWrapper = this.mainAreaEl?.querySelector(".chronos-scroll-wrapper");
    if (scrollWrapper) {
      const centerX = todayX - (scrollWrapper.clientWidth / 2);
      scrollWrapper.scrollLeft = Math.max(0, centerX);
    }
  }

  private setZoom(level: ZoomLevel): void {
    this.zoom = level;
    this.toolbarEl?.querySelectorAll(".chronos-zoom-btn").forEach((btn) => {
      btn.toggleClass("chronos-active", (btn as HTMLElement).dataset.zoom === level);
    });
    this.render();
  }

  private toggleFilterPanel(): void {
    if (this.filterPanelEl) {
      this.filterPanelEl.classList.toggle("chronos-hidden");
    }
  }

  private updateCounter(visible: number, total: number): void {
    if (this.counterEl) {
      this.counterEl.textContent = visible === total
        ? `${total} notes`
        : `${visible} / ${total} notes`;
    }
  }

  /** Called by the plugin when settings change */
  updateSettings(settings: ChronosSettings): void {
    this.settings = settings;
    this.zoom = settings.defaultZoom;
    this.loadAndRender();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
