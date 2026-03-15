import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── DOM stubs ───────────────────────────────────────────────────────────────
// NoteCard uses document.createElement and the resulting element's DOM APIs.
// We build a minimal mock that supports the addEventListener / classList / style
// APIs needed for the tests.

type EventCallback = (evt: unknown) => void;

function makeElement() {
  const listeners: Record<string, EventCallback[]> = {};
  const classList = {
    _classes: new Set<string>(),
    add: vi.fn((cls: string) => classList._classes.add(cls)),
    remove: vi.fn((cls: string) => classList._classes.delete(cls)),
    contains: vi.fn((cls: string) => classList._classes.has(cls)),
  };

  const styleStore: Record<string, string> = {};
  const style = new Proxy(styleStore, {
    get(target, prop) {
      if (prop === "setProperty") return (k: string, v: string) => { target[k] = v; };
      if (prop === "transform") return target["transform"] ?? "";
      return target[prop as string] ?? "";
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });

  const el = {
    className: "",
    title: "",
    draggable: false,
    style,
    dataset: {} as Record<string, string>,
    getAttribute: vi.fn(),
    setAttribute: vi.fn((_k: string, v: string) => { el.title = v; }),
    classList,
    children: [] as unknown[],
    // Capture event listeners for manual dispatch in tests
    addEventListener: vi.fn((event: string, cb: EventCallback) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    dispatchEvent: vi.fn(),
    createDiv: vi.fn((_opts?: { cls?: string; text?: string }) => makeElement()),
    createSpan: vi.fn((_opts?: { cls?: string; text?: string }) => makeElement()),
    createEl: vi.fn((_tag: string, _opts?: object) => makeElement()),
    appendChild: vi.fn(),
    // Helper for test: fire a named event with a payload
    _fire: (event: string, payload: unknown = {}) => {
      (listeners[event] ?? []).forEach((cb) => cb(payload));
    },
    _listeners: listeners,
  };
  return el;
}

// Install the document stub before importing createNoteCard
const mockCard = makeElement();
vi.stubGlobal("document", {
  createElement: vi.fn(() => mockCard),
});

// ─── Import after stubbing ───────────────────────────────────────────────────
import { createNoteCard } from "../components/NoteCard";
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
    wordCount: 0,
    ...overrides,
  };
}

describe("NoteCard click handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset card state between tests
    mockCard._listeners["click"] = [];
    mockCard._listeners["mouseenter"] = [];
    mockCard._listeners["dragstart"] = [];
    mockCard._listeners["dragend"] = [];
    mockCard._listeners["touchstart"] = [];
    mockCard._listeners["touchmove"] = [];
    mockCard._listeners["touchend"] = [];
    mockCard.classList._classes.clear();
    vi.clearAllMocks();
    // Restore createElement to always return the same mock
    (document.createElement as ReturnType<typeof vi.fn>).mockReturnValue(mockCard);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("single click calls onSelect after 240ms, not onOpen", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    createNoteCard(makeNote(), 0, 0, 180, onSelect, onOpen, vi.fn(), vi.fn());

    // Simulate one click
    mockCard._fire("click", { stopPropagation: vi.fn() });

    // Before timer fires, neither should have been called
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();

    // Advance past 240ms
    vi.advanceTimersByTime(241);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("double click cancels single-click timer and calls onOpen", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    createNoteCard(makeNote(), 0, 0, 180, onSelect, onOpen, vi.fn(), vi.fn());

    const evt = { stopPropagation: vi.fn() };

    // First click — starts the timer
    mockCard._fire("click", evt);
    // Second click within 240ms — should clear timer and call onOpen
    mockCard._fire("click", evt);

    // Timer should have been cleared; onSelect should not be called
    vi.advanceTimersByTime(300);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("NoteCard touch handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCard._listeners["touchstart"] = [];
    mockCard._listeners["touchmove"] = [];
    mockCard._listeners["touchend"] = [];
    mockCard.classList._classes.clear();
    vi.clearAllMocks();
    (document.createElement as ReturnType<typeof vi.fn>).mockReturnValue(mockCard);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("short tap (< 400ms) does NOT call onTouchDrag", () => {
    const onTouchDrag = vi.fn();
    createNoteCard(makeNote(), 0, 0, 180, vi.fn(), vi.fn(), vi.fn(), vi.fn(), false, onTouchDrag);

    // touchstart
    mockCard._fire("touchstart", {
      touches: [{ clientX: 100 }],
      preventDefault: vi.fn(),
    });

    // Advance only 200ms (< 400ms long-press threshold)
    vi.advanceTimersByTime(200);

    // touchmove with big delta — but dragActive is false, so ignored
    mockCard._fire("touchmove", {
      touches: [{ clientX: 200 }],
      preventDefault: vi.fn(),
    });

    // touchend before long-press fires
    mockCard._fire("touchend", {
      changedTouches: [{ clientX: 200 }],
      preventDefault: vi.fn(),
    });

    expect(onTouchDrag).not.toHaveBeenCalled();
  });

  it("long press + drag calls onTouchDrag with approximate deltaX", () => {
    const onTouchDrag = vi.fn();
    createNoteCard(makeNote(), 0, 0, 180, vi.fn(), vi.fn(), vi.fn(), vi.fn(), false, onTouchDrag);

    // touchstart
    mockCard._fire("touchstart", {
      touches: [{ clientX: 100 }],
      preventDefault: vi.fn(),
    });

    // Advance past 400ms to activate long-press
    vi.advanceTimersByTime(401);

    // touchmove with sufficient delta to set touchMoved = true
    mockCard._fire("touchmove", {
      touches: [{ clientX: 200 }],
      preventDefault: vi.fn(),
    });

    // touchend
    mockCard._fire("touchend", {
      changedTouches: [{ clientX: 200 }],
      preventDefault: vi.fn(),
    });

    expect(onTouchDrag).toHaveBeenCalledOnce();
    const deltaX = onTouchDrag.mock.calls[0][1] as number;
    expect(Math.abs(deltaX - 100)).toBeLessThan(5); // approximately 100px
  });
});
