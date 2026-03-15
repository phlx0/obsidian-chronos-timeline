import { describe, it, expect } from "vitest";
import { assignLanes } from "../utils/noteLoader";
import { TimelineNote } from "../types";

function makeNote(dateStr: string, path?: string): TimelineNote {
  return {
    path: path ?? `notes/${dateStr}.md`,
    title: dateStr,
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

describe("assignLanes", () => {
  const viewStart = new Date("2024-01-01");

  it("assigns all non-overlapping notes to lane 0", () => {
    const notes = [
      makeNote("2024-01-01"),
      makeNote("2024-04-01"),
      makeNote("2024-08-01"),
    ];
    assignLanes(notes, viewStart, "month", 180, 8);
    expect(notes.every((n) => n.laneIndex === 0)).toBe(true);
  });

  it("assigns overlapping notes to different lanes", () => {
    // Two notes on the same day — they overlap, so they get different lanes
    const notes = [
      makeNote("2024-01-01", "a.md"),
      makeNote("2024-01-01", "b.md"),
    ];
    assignLanes(notes, viewStart, "month", 180, 8);
    const lanes = notes.map((n) => n.laneIndex);
    expect(lanes[0]).not.toBe(lanes[1]);
  });

  it("wraps to last lane when maxLanes exceeded", () => {
    // 5 notes all on same day with maxLanes=3 → 5th goes to lane 2 (last)
    const notes = Array.from({ length: 5 }, (_, i) =>
      makeNote("2024-01-01", `note${i}.md`)
    );
    assignLanes(notes, viewStart, "month", 180, 3);
    const usedLanes = new Set(notes.map((n) => n.laneIndex));
    // All lanes should be <= 2
    expect([...usedLanes].every((l) => l <= 2)).toBe(true);
  });

  it("reuses lanes for non-overlapping notes after overlap", () => {
    // note1 on day 1, note2 on day 1 (overlap → different lanes)
    // note3 on day 200 (no overlap with either → should go back to lane 0)
    const notes = [
      makeNote("2024-01-01", "a.md"),
      makeNote("2024-01-01", "b.md"),
      makeNote("2024-08-01", "c.md"), // far future, no overlap
    ];
    assignLanes(notes, viewStart, "month", 180, 8);
    expect(notes[2].laneIndex).toBe(0);
  });
});
