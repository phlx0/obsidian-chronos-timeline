import { TimelineNote, SerializableFilters } from "../types";

export interface ActiveFilters {
  tags: Set<string>;
  folders: Set<string>;
  searchQuery: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export function createEmptyFilters(): ActiveFilters {
  return {
    tags: new Set(),
    folders: new Set(),
    searchQuery: "",
    dateFrom: null,
    dateTo: null,
  };
}

export function matchesFilters(note: TimelineNote, filters: ActiveFilters): boolean {
  if (filters.tags.size > 0) {
    const hasTag = note.tags.some((t) => filters.tags.has(t));
    if (!hasTag) return false;
  }

  if (filters.folders.size > 0) {
    if (!filters.folders.has(note.folder)) return false;
  }

  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    if (!note.title.toLowerCase().includes(q)) return false;
  }

  if (filters.dateFrom && note.date < filters.dateFrom) return false;
  if (filters.dateTo && note.date > filters.dateTo) return false;

  return true;
}

function serializeFilters(f: ActiveFilters): SerializableFilters {
  return {
    tags: [...f.tags],
    folders: [...f.folders],
    searchQuery: f.searchQuery,
    dateFrom: f.dateFrom ? f.dateFrom.toISOString().split("T")[0] : null,
    dateTo: f.dateTo ? f.dateTo.toISOString().split("T")[0] : null,
  };
}

function deserializeFilters(s: SerializableFilters): ActiveFilters {
  return {
    tags: new Set(s.tags),
    folders: new Set(s.folders),
    searchQuery: s.searchQuery,
    dateFrom: s.dateFrom ? new Date(s.dateFrom) : null,
    dateTo: s.dateTo ? new Date(s.dateTo) : null,
  };
}

/**
 * Builds the filter panel sidebar DOM.
 * Calls `onChange` whenever any filter changes.
 * If `persistKey` is given, state is persisted to localStorage.
 */
export class FilterPanel {
  private container: HTMLElement;
  private filters: ActiveFilters;
  private onChange: (filters: ActiveFilters) => void;
  private persistKey: string | null;

  // Input refs for reset
  private searchInput: HTMLInputElement | null = null;
  private fromInput: HTMLInputElement | null = null;
  private toInput: HTMLInputElement | null = null;

  constructor(
    parent: HTMLElement,
    onChange: (filters: ActiveFilters) => void,
    persistKey?: string
  ) {
    this.persistKey = persistKey ?? null;
    this.filters = this.loadPersistedFilters() ?? createEmptyFilters();
    this.onChange = onChange;
    this.container = parent.createDiv({ cls: "chronos-filter-panel" });
    this.buildHeader();
    this.buildDateRange();
  }

  private loadPersistedFilters(): ActiveFilters | null {
    if (!this.persistKey) return null;
    try {
      const raw = localStorage.getItem(this.persistKey);
      if (!raw) return null;
      return deserializeFilters(JSON.parse(raw) as SerializableFilters);
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (!this.persistKey) return;
    try {
      localStorage.setItem(this.persistKey, JSON.stringify(serializeFilters(this.filters)));
    } catch {
      // ignore storage errors
    }
  }

  private fireChange(): void {
    this.persist();
    this.onChange(this.filters);
  }

  private buildHeader(): void {
    this.container.createEl("h3", {
      cls: "chronos-filter-heading",
      text: "Filters",
    });
  }

  private buildDateRange(): void {
    const section = this.container.createDiv({ cls: "chronos-filter-section" });
    section.createEl("label", { cls: "chronos-filter-label", text: "Date range" });

    const fromRow = section.createDiv({ cls: "chronos-filter-date-row" });
    fromRow.createSpan({ text: "From" });
    this.fromInput = fromRow.createEl("input", { type: "date", cls: "chronos-filter-input" }) as HTMLInputElement;
    if (this.filters.dateFrom) {
      this.fromInput.value = this.filters.dateFrom.toISOString().split("T")[0];
    }

    const toRow = section.createDiv({ cls: "chronos-filter-date-row" });
    toRow.createSpan({ text: "To" });
    this.toInput = toRow.createEl("input", { type: "date", cls: "chronos-filter-input" }) as HTMLInputElement;
    if (this.filters.dateTo) {
      this.toInput.value = this.filters.dateTo.toISOString().split("T")[0];
    }

    this.fromInput.addEventListener("change", () => {
      this.filters.dateFrom = this.fromInput!.value ? new Date(this.fromInput!.value) : null;
      this.fireChange();
    });
    this.toInput.addEventListener("change", () => {
      this.filters.dateTo = this.toInput!.value ? new Date(this.toInput!.value) : null;
      this.fireChange();
    });
  }

  /**
   * Re-populates the tag and folder lists based on the current notes.
   */
  rebuildTagsAndFolders(notes: TimelineNote[]): void {
    this.container.querySelectorAll(".chronos-filter-dynamic").forEach((el) => el.remove());

    const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();
    const allFolders = [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort();

    if (allTags.length > 0) {
      this.buildCheckboxGroup("Tags", allTags, this.filters.tags, (tag, checked) => {
        if (checked) this.filters.tags.add(tag);
        else this.filters.tags.delete(tag);
        this.fireChange();
      });
    }

    if (allFolders.length > 0) {
      this.buildCheckboxGroup("Folders", allFolders, this.filters.folders, (folder, checked) => {
        if (checked) this.filters.folders.add(folder);
        else this.filters.folders.delete(folder);
        this.fireChange();
      });
    }
  }

  private buildCheckboxGroup(
    label: string,
    items: string[],
    activeSet: Set<string>,
    onChange: (item: string, checked: boolean) => void
  ): void {
    const section = this.container.createDiv({ cls: "chronos-filter-section chronos-filter-dynamic" });
    section.createEl("label", { cls: "chronos-filter-label", text: label });

    const list = section.createDiv({ cls: "chronos-filter-checklist" });
    for (const item of items) {
      const row = list.createDiv({ cls: "chronos-filter-check-row" });
      const cb = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
      cb.checked = activeSet.has(item);
      cb.addEventListener("change", () => onChange(item, cb.checked));
      row.createSpan({ text: item });
    }
  }

  /** Apply a search query externally (from toolbar search input). */
  setSearchQuery(query: string): void {
    this.filters.searchQuery = query;
    this.fireChange();
  }

  getFilters(): ActiveFilters {
    return this.filters;
  }

  resetFilters(): void {
    this.filters = createEmptyFilters();
    if (this.fromInput) this.fromInput.value = "";
    if (this.toInput) this.toInput.value = "";
    this.container.querySelectorAll("input[type=checkbox]").forEach((el) => {
      (el as HTMLInputElement).checked = false;
    });
    this.fireChange();
  }

  getContainer(): HTMLElement {
    return this.container;
  }
}
