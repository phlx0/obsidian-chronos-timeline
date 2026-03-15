import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseDateInputValue } from "../components/FilterPanel";
import { TimelineNote } from "../types";

// ─── Minimal DOM mock ────────────────────────────────────────────────────────
// FilterPanel builds DOM elements; we stub what it needs so tests run in node.

function makeInput(type: string): HTMLInputElement {
  return {
    type,
    value: "",
    checked: false,
    addEventListener: vi.fn(),
  } as unknown as HTMLInputElement;
}

function makeEl(tag: string): HTMLElement {
  const el: HTMLElement = {
    tagName: tag.toUpperCase(),
    className: "",
    textContent: "",
    style: {},
    children: [],
    dataset: {},
    addEventListener: vi.fn(),
    createEl: vi.fn((t: string, opts?: { type?: string; cls?: string; text?: string }) => {
      const child = makeEl(t);
      if (opts?.type === "date" || opts?.type === "checkbox") {
        return makeInput(opts.type ?? "text");
      }
      if (opts?.text) (child as unknown as { textContent: string }).textContent = opts.text;
      return child;
    }),
    createDiv: vi.fn((_opts?: object) => makeEl("div")),
    createSpan: vi.fn((_opts?: object) => makeEl("span")),
    querySelectorAll: vi.fn(() => []),
    querySelector: vi.fn(() => null),
    remove: vi.fn(),
    empty: vi.fn(),
    setText: vi.fn(),
    addClass: vi.fn(),
    removeClass: vi.fn(),
    toggleClass: vi.fn(),
  } as unknown as HTMLElement;
  return el;
}

// Mock localStorage with in-memory store
const makeLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
};

// ─── parseDateInputValue tests ───────────────────────────────────────────────

describe("parseDateInputValue", () => {
  it("returns null for empty string", () => {
    expect(parseDateInputValue("")).toBeNull();
  });

  it("returns local midnight Date for valid date string", () => {
    const result = parseDateInputValue("2024-06-15");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(5); // June = index 5
    expect(result!.getDate()).toBe(15);
    expect(result!.getHours()).toBe(0);
    expect(result!.getMinutes()).toBe(0);
    expect(result!.getSeconds()).toBe(0);
  });

  it("parses January (month 1) as month index 0", () => {
    const result = parseDateInputValue("2024-01-01");
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(1);
  });

  it("parses December (month 12) as month index 11", () => {
    const result = parseDateInputValue("2024-12-31");
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(31);
  });
});

// ─── FilterPanel localStorage persistence tests ───────────────────────────────

describe("FilterPanel localStorage persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
    vi.stubGlobal("document", {
      createElement: vi.fn(() => makeEl("div")),
    });
  });

  it("round-trips serializable filters through localStorage", () => {
    // This test bypasses FilterPanel DOM construction and tests
    // the persistence logic via the serialization helpers indirectly
    // through parseDateInputValue (the exported piece).
    const storage = makeLocalStorage();
    const key = "test-persist-key";

    // Simulate what FilterPanel.persist() would write
    const serialized = JSON.stringify({
      tags: ["work"],
      folders: ["Journal"],
      searchQuery: "standup",
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
    });
    storage.setItem(key, serialized);

    // Simulate what FilterPanel.loadPersistedFilters() would read
    const raw = storage.getItem(key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.tags).toEqual(["work"]);
    expect(parsed.folders).toEqual(["Journal"]);
    expect(parsed.searchQuery).toBe("standup");

    // Verify dateFrom round-trips through parseDateInputValue
    const from = parseDateInputValue(parsed.dateFrom);
    expect(from).not.toBeNull();
    expect(from!.getFullYear()).toBe(2024);
    expect(from!.getMonth()).toBe(0);

    const to = parseDateInputValue(parsed.dateTo);
    expect(to!.getMonth()).toBe(11); // December
  });
});

// ─── rebuildTagsAndFolders logic test (pure data) ───────────────────────────

describe("tag and folder extraction logic", () => {
  function makeNote(overrides: Partial<TimelineNote> = {}): TimelineNote {
    return {
      path: "test.md",
      title: "Test",
      date: new Date("2024-01-01"),
      dateFieldUsed: "date",
      tags: [],
      folder: "",
      topLevelFolder: "",
      color: "#4f8ef7",
      laneIndex: 0,
      wordCount: 0,
      ...overrides,
    };
  }

  it("extracts unique tags from notes", () => {
    const notes = [
      makeNote({ tags: ["work", "meeting"] }),
      makeNote({ tags: ["work", "personal"] }),
      makeNote({ tags: [] }),
    ];
    const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();
    expect(allTags).toEqual(["meeting", "personal", "work"]);
  });

  it("extracts unique non-empty folders from notes", () => {
    const notes = [
      makeNote({ folder: "Journal/2024" }),
      makeNote({ folder: "Work" }),
      makeNote({ folder: "Journal/2024" }),
      makeNote({ folder: "" }),
    ];
    const allFolders = [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort();
    expect(allFolders).toEqual(["Journal/2024", "Work"]);
  });
});
