import { describe, it, expect, vi } from "vitest";
import { expandWithRecurring } from "../utils/noteLoader";
import { TimelineNote, ChronosSettings, DEFAULT_SETTINGS } from "../types";
import { TFile } from "../__mocks__/obsidian";

function makeNote(dateStr: string, path = `notes/${dateStr}.md`): TimelineNote {
  return {
    path,
    title: path,
    date: new Date(dateStr),
    dateFieldUsed: "date",
    tags: [],
    folder: "notes",
    topLevelFolder: "notes",
    color: "#4f8ef7",
    laneIndex: 0,
    wordCount: 100,
  };
}

function makeApp(recurrenceValue?: string) {
  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) => {
        const f = new TFile();
        f.path = path;
        f.basename = path;
        return f;
      }),
    },
    metadataCache: {
      getFileCache: vi.fn(() =>
        recurrenceValue
          ? { frontmatter: { recurrence: recurrenceValue } }
          : { frontmatter: {} }
      ),
    },
  };
}

const settings: ChronosSettings = {
  ...DEFAULT_SETTINGS,
  enableRecurring: true,
  recurringField: "recurrence",
};

describe("expandWithRecurring", () => {
  it("returns original notes unchanged when enableRecurring is false", () => {
    const notes = [makeNote("2024-01-01")];
    const app = makeApp("weekly");
    const result = expandWithRecurring(
      notes,
      app as never,
      { ...settings, enableRecurring: false },
      new Date("2024-01-01"),
      new Date("2024-01-31")
    );
    expect(result).toHaveLength(1);
    expect(result[0].isRecurring).toBeUndefined();
  });

  it("generates ghost copies for a weekly recurring note", () => {
    const notes = [makeNote("2024-01-01")];
    const app = makeApp("weekly");
    const result = expandWithRecurring(
      notes,
      app as never,
      settings,
      new Date("2024-01-01"),
      new Date("2024-01-29")
    );
    // Original + 4 ghosts (Jan 8, 15, 22, 29)
    expect(result.length).toBeGreaterThan(1);
    const ghosts = result.filter((n) => n.isRecurring);
    expect(ghosts.length).toBe(4);
    expect(ghosts.every((n) => n.endDate === undefined)).toBe(true);
  });

  it("skips notes where the file no longer exists", () => {
    const notes = [makeNote("2024-01-01")];
    const app = {
      vault: { getAbstractFileByPath: vi.fn(() => null) },
      metadataCache: { getFileCache: vi.fn() },
    };
    // Should not throw — instanceof guard protects against null
    const result = expandWithRecurring(
      notes,
      app as never,
      settings,
      new Date("2024-01-01"),
      new Date("2024-01-31")
    );
    expect(result).toHaveLength(1);
  });

  it("skips notes with no recurrence field", () => {
    const notes = [makeNote("2024-01-01")];
    const app = makeApp(undefined); // no recurrence in frontmatter
    const result = expandWithRecurring(
      notes,
      app as never,
      settings,
      new Date("2024-01-01"),
      new Date("2024-01-31")
    );
    expect(result).toHaveLength(1);
  });

  it("skips notes with invalid recurrence value", () => {
    const notes = [makeNote("2024-01-01")];
    const app = makeApp("hourly"); // invalid
    const result = expandWithRecurring(
      notes,
      app as never,
      settings,
      new Date("2024-01-01"),
      new Date("2024-01-31")
    );
    expect(result).toHaveLength(1);
  });
});
