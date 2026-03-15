import { describe, it, expect } from "vitest";
import { matchesFilters, createEmptyFilters, ActiveFilters } from "../components/FilterPanel";
import { TimelineNote } from "../types";

function makeNote(overrides: Partial<TimelineNote> = {}): TimelineNote {
  return {
    path: "test/note.md",
    title: "Test Note",
    date: new Date("2024-03-15"),
    dateFieldUsed: "date",
    tags: [],
    folder: "test",
    topLevelFolder: "test",
    color: "#4f8ef7",
    laneIndex: 0,
    wordCount: 100,
    ...overrides,
  };
}

describe("matchesFilters", () => {
  it("passes note with empty filters", () => {
    const note = makeNote();
    expect(matchesFilters(note, createEmptyFilters())).toBe(true);
  });

  it("filters by search query (case insensitive)", () => {
    const note = makeNote({ title: "My Meeting Notes" });
    const filters: ActiveFilters = {
      ...createEmptyFilters(),
      searchQuery: "meeting",
    };
    expect(matchesFilters(note, filters)).toBe(true);

    const noMatch: ActiveFilters = { ...createEmptyFilters(), searchQuery: "project" };
    expect(matchesFilters(note, noMatch)).toBe(false);
  });

  it("filters by tags (any match)", () => {
    const note = makeNote({ tags: ["work", "meeting"] });
    const filters: ActiveFilters = {
      ...createEmptyFilters(),
      tags: new Set(["meeting"]),
    };
    expect(matchesFilters(note, filters)).toBe(true);

    const noMatch: ActiveFilters = {
      ...createEmptyFilters(),
      tags: new Set(["personal"]),
    };
    expect(matchesFilters(note, noMatch)).toBe(false);
  });

  it("filters by folder", () => {
    const note = makeNote({ folder: "Journal/2024" });
    const filters: ActiveFilters = {
      ...createEmptyFilters(),
      folders: new Set(["Journal/2024"]),
    };
    expect(matchesFilters(note, filters)).toBe(true);

    const noMatch: ActiveFilters = {
      ...createEmptyFilters(),
      folders: new Set(["Work"]),
    };
    expect(matchesFilters(note, noMatch)).toBe(false);
  });

  it("filters by dateFrom", () => {
    const note = makeNote({ date: new Date("2024-03-15") });
    const after: ActiveFilters = {
      ...createEmptyFilters(),
      dateFrom: new Date("2024-03-10"),
    };
    expect(matchesFilters(note, after)).toBe(true);

    const before: ActiveFilters = {
      ...createEmptyFilters(),
      dateFrom: new Date("2024-03-20"),
    };
    expect(matchesFilters(note, before)).toBe(false);
  });

  it("filters by dateTo", () => {
    const note = makeNote({ date: new Date("2024-03-15") });
    const before: ActiveFilters = {
      ...createEmptyFilters(),
      dateTo: new Date("2024-03-20"),
    };
    expect(matchesFilters(note, before)).toBe(true);

    const after: ActiveFilters = {
      ...createEmptyFilters(),
      dateTo: new Date("2024-03-10"),
    };
    expect(matchesFilters(note, after)).toBe(false);
  });

  it("combines multiple filters (all must pass)", () => {
    const note = makeNote({
      title: "Weekly Review",
      tags: ["journal"],
      date: new Date("2024-03-15"),
    });
    const filters: ActiveFilters = {
      searchQuery: "weekly",
      tags: new Set(["journal"]),
      folders: new Set(),
      dateFrom: new Date("2024-01-01"),
      dateTo: new Date("2024-12-31"),
    };
    expect(matchesFilters(note, filters)).toBe(true);
  });
});
