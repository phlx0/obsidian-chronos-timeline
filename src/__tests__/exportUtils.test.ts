import { describe, it, expect, vi, beforeEach } from "vitest";

// Canvas mock — must be set up before importing exportUtils
function makeCtx() {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
  };
}

const mockCtx = makeCtx();
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockCtx),
  toBlob: vi.fn((cb: (blob: Blob) => void) => cb(new Blob())),
};

vi.stubGlobal("document", {
  createElement: vi.fn((tag: string) => {
    if (tag === "canvas") return mockCanvas;
    return {
      href: "",
      download: "",
      click: vi.fn(),
    };
  }),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
});

vi.stubGlobal("URL", {
  createObjectURL: vi.fn(() => "blob:mock"),
  revokeObjectURL: vi.fn(),
});

import { exportTimelineAsPng } from "../utils/exportUtils";
import { TimelineNote } from "../types";

function makeNote(dateStr: string, overrides: Partial<TimelineNote> = {}): TimelineNote {
  return {
    path: `notes/${dateStr}.md`,
    title: dateStr,
    date: new Date(dateStr),
    dateFieldUsed: "date",
    tags: [],
    folder: "notes",
    topLevelFolder: "notes",
    color: "#4f8ef7",
    laneIndex: 0,
    wordCount: 100,
    ...overrides,
  };
}

describe("exportTimelineAsPng", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockCtx, makeCtx());
  });

  it("creates a canvas and calls toBlob", () => {
    const notes = [makeNote("2024-03-15")];
    exportTimelineAsPng(notes, new Date("2024-01-01"), "month", 2000, 300, 180, false);
    expect(mockCanvas.getContext).toHaveBeenCalledWith("2d");
    expect(mockCanvas.toBlob).toHaveBeenCalledOnce();
  });

  it("sets canvas dimensions from totalWidth and trackHeight", () => {
    const notes = [makeNote("2024-06-01")];
    exportTimelineAsPng(notes, new Date("2024-01-01"), "month", 1500, 400, 180, false);
    // Canvas width capped at MAX_CANVAS_W (4096); height = AXIS_H(48) + trackHeight(400)
    expect(mockCanvas.height).toBe(48 + 400);
  });

  it("draws background fill rect", () => {
    exportTimelineAsPng([], new Date("2024-01-01"), "month", 800, 200, 180, false);
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it("renders Gantt notes with wider width", () => {
    const note = makeNote("2024-03-01", {
      endDate: new Date("2024-03-31"),
    });
    // Should not throw — Gantt width calculation path executes
    expect(() =>
      exportTimelineAsPng([note], new Date("2024-01-01"), "month", 2000, 300, 180, false)
    ).not.toThrow();
  });

  it("passes for dark mode without errors", () => {
    const notes = [makeNote("2024-06-15")];
    expect(() =>
      exportTimelineAsPng(notes, new Date("2024-01-01"), "month", 2000, 300, 180, true)
    ).not.toThrow();
  });
});
