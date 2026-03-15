import { TimelineNote, CARD_HEIGHT_PX, LANE_HEIGHT_PX, MAX_WORD_COUNT_REF } from "../types";

export { CARD_HEIGHT_PX, LANE_HEIGHT_PX };

/**
 * Creates a positioned note card element.
 *
 * - Single click  → onSelect (highlight only)
 * - Double click  → onOpen (navigate to note)
 * - Drag start    → onDragStart (reschedule)
 * - Mouse enter   → onHover (preview popup)
 */
export function createNoteCard(
  note: TimelineNote,
  xPx: number,
  yOffsetPx: number,
  cardWidthPx: number,
  onSelect: (note: TimelineNote, evt: MouseEvent) => void,
  onOpen: (note: TimelineNote, evt: MouseEvent) => void,
  onHover: (note: TimelineNote, target: HTMLElement, evt: MouseEvent) => void,
  onDragStart: (note: TimelineNote, evt: DragEvent) => void
): HTMLElement {
  const card = document.createElement("div");
  card.className = "chronos-note-card";
  card.setAttribute("data-path", note.path);
  card.setAttribute("aria-label", note.title);
  card.draggable = true;

  card.style.left = `${xPx}px`;
  card.style.top = `${yOffsetPx + note.laneIndex * LANE_HEIGHT_PX + 8}px`;
  card.style.width = `${cardWidthPx}px`;
  card.style.height = `${CARD_HEIGHT_PX}px`;
  card.style.setProperty("--chronos-card-color", note.color);

  // Left accent bar
  const accent = card.createDiv({ cls: "chronos-card-accent" });
  accent.style.backgroundColor = note.color;

  card.createDiv({ cls: "chronos-card-title", text: note.title });
  card.createDiv({ cls: "chronos-card-date", text: formatDate(note.date) });

  if (note.tags.length > 0) {
    const tagsRow = card.createDiv({ cls: "chronos-card-tags" });
    note.tags.slice(0, 3).forEach((tag) => {
      tagsRow.createSpan({ cls: "chronos-card-tag", text: `#${tag}` });
    });
  }

  // Word count bar (relative size indicator)
  if (note.wordCount > 0) {
    const pct = Math.min(100, (note.wordCount / MAX_WORD_COUNT_REF) * 100);
    const bar = card.createDiv({ cls: "chronos-card-size-bar" });
    const fill = bar.createDiv({ cls: "chronos-card-size-fill" });
    fill.style.width = `${pct}%`;
    fill.style.backgroundColor = note.color;
  }

  // Click timer: single = select, double = open
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  card.addEventListener("click", (evt) => {
    evt.stopPropagation();
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      onOpen(note, evt);
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        onSelect(note, evt);
      }, 240);
    }
  });

  card.addEventListener("mouseenter", (evt) => onHover(note, card, evt));

  card.addEventListener("dragstart", (evt) => {
    card.addClass("chronos-dragging");
    onDragStart(note, evt as DragEvent);
  });
  card.addEventListener("dragend", () => card.removeClass("chronos-dragging"));

  return card;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
