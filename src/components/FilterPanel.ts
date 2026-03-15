import { TimelineNote } from "../types";

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

/**
 * Builds the filter panel sidebar DOM.
 * Calls `onChange` whenever any filter changes.
 */
export class FilterPanel {
  private container: HTMLElement;
  private filters: ActiveFilters;
  private onChange: (filters: ActiveFilters) => void;

  constructor(parent: HTMLElement, onChange: (filters: ActiveFilters) => void) {
    this.filters = createEmptyFilters();
    this.onChange = onChange;
    this.container = parent.createDiv({ cls: "chronos-filter-panel" });
    this.buildHeader();
    this.buildSearchBox();
    this.buildDateRange();
  }

  private buildHeader(): void {
    this.container.createEl("h3", {
      cls: "chronos-filter-heading",
      text: "Filters",
    });
  }

  private buildSearchBox(): void {
    const section = this.container.createDiv({ cls: "chronos-filter-section" });
    section.createEl("label", { cls: "chronos-filter-label", text: "Search title" });
    const input = section.createEl("input", {
      type: "text",
      placeholder: "Type to filter…",
      cls: "chronos-filter-input",
    });
    input.addEventListener("input", () => {
      this.filters.searchQuery = input.value.trim();
      this.onChange(this.filters);
    });
  }

  private buildDateRange(): void {
    const section = this.container.createDiv({ cls: "chronos-filter-section" });
    section.createEl("label", { cls: "chronos-filter-label", text: "Date range" });

    const fromRow = section.createDiv({ cls: "chronos-filter-date-row" });
    fromRow.createSpan({ text: "From" });
    const fromInput = fromRow.createEl("input", { type: "date", cls: "chronos-filter-input" });

    const toRow = section.createDiv({ cls: "chronos-filter-date-row" });
    toRow.createSpan({ text: "To" });
    const toInput = toRow.createEl("input", { type: "date", cls: "chronos-filter-input" });

    fromInput.addEventListener("change", () => {
      this.filters.dateFrom = fromInput.value ? new Date(fromInput.value) : null;
      this.onChange(this.filters);
    });
    toInput.addEventListener("change", () => {
      this.filters.dateTo = toInput.value ? new Date(toInput.value) : null;
      this.onChange(this.filters);
    });
  }

  /**
   * Re-populates the tag and folder lists based on the current notes.
   * Called whenever the note set changes.
   */
  rebuildTagsAndFolders(notes: TimelineNote[]): void {
    // Remove old dynamic sections
    this.container.querySelectorAll(".chronos-filter-dynamic").forEach((el) => el.remove());

    const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();
    const allFolders = [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort();

    if (allTags.length > 0) {
      this.buildCheckboxGroup("Tags", allTags, this.filters.tags, (tag, checked) => {
        if (checked) this.filters.tags.add(tag);
        else this.filters.tags.delete(tag);
        this.onChange(this.filters);
      });
    }

    if (allFolders.length > 0) {
      this.buildCheckboxGroup("Folders", allFolders, this.filters.folders, (folder, checked) => {
        if (checked) this.filters.folders.add(folder);
        else this.filters.folders.delete(folder);
        this.onChange(this.filters);
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
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = activeSet.has(item);
      cb.addEventListener("change", () => onChange(item, cb.checked));
      row.createSpan({ text: item });
    }
  }

  resetFilters(): void {
    this.filters = createEmptyFilters();
    // Clear all inputs
    this.container.querySelectorAll("input[type=text], input[type=date]").forEach((el) => {
      (el as HTMLInputElement).value = "";
    });
    this.container.querySelectorAll("input[type=checkbox]").forEach((el) => {
      (el as HTMLInputElement).checked = false;
    });
    this.onChange(this.filters);
  }

  getContainer(): HTMLElement {
    return this.container;
  }
}
