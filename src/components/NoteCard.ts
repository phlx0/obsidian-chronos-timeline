import { TimelineNote, CARD_HEIGHT_PX, LANE_HEIGHT_PX, MAX_WORD_COUNT_REF, ZOOM_PX_PER_DAY, ZoomLevel } from "../types";

export { CARD_HEIGHT_PX, LANE_HEIGHT_PX };

/**
 * Creates a positioned note card element.
 *
 * - Single click  → onSelect (highlight only)
 * - Double click  → onOpen (navigate to note)
 * - Drag start    → onDragStart (reschedule)
 * - Mouse enter   → onHover (preview popup)
 * - Touch drag    → onTouchDrag (mobile reschedule)
 */
export function createNoteCard(
  note: TimelineNote,
  xPx: number,
  yOffsetPx: number,
  cardWidthPx: number,
  onSelect: (note: TimelineNote, evt: MouseEvent) => void,
  onOpen: (note: TimelineNote, evt: MouseEvent) => void,
  onHover: (note: TimelineNote, target: HTMLElement, evt: MouseEvent) => void,
  onDragStart: (note: TimelineNote, evt: DragEvent) => void,
  showRelativeDates = false,
  onTouchDrag?: (note: TimelineNote, deltaXPx: number) => void
): HTMLElement {
  const card = document.createElement("div");
  card.className = "chronos-note-card";
  card.setAttribute("data-path", note.path);
  // Full title as native tooltip
  card.title = note.title;
  card.draggable = true;

  if (note.isRecurring) card.classList.add("chronos-card-recurring");
  if (note.endDate) card.classList.add("chronos-card-gantt");

  card.style.left = `${xPx}px`;
  card.style.top = `${yOffsetPx + note.laneIndex * LANE_HEIGHT_PX + 8}px`;
  card.style.width = `${cardWidthPx}px`;
  card.style.height = `${CARD_HEIGHT_PX}px`;
  card.style.setProperty("--chronos-card-color", note.color);

  // Left accent bar
  const accent = card.createDiv({ cls: "chronos-card-accent" });
  accent.style.backgroundColor = note.isRecurring
    ? note.color + "88"
    : note.color;

  card.createDiv({ cls: "chronos-card-title", text: note.title });

  const dateText = showRelativeDates ? formatRelativeDate(note.date) : formatDate(note.date);
  card.createDiv({ cls: "chronos-card-date", text: dateText });

  if (note.tags.length > 0) {
    const tagsRow = card.createDiv({ cls: "chronos-card-tags" });
    note.tags.slice(0, 3).forEach((tag) => {
      tagsRow.createSpan({ cls: "chronos-card-tag", text: `#${tag}` });
    });
  }

  // Word count bar
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
    card.classList.add("chronos-dragging");
    onDragStart(note, evt as DragEvent);
  });
  card.addEventListener("dragend", () => card.classList.remove("chronos-dragging"));

  // Touch drag
  if (onTouchDrag) {
    let touchStartX = 0;
    let touchMoved = false;

    card.addEventListener("touchstart", (evt) => {
      if (evt.touches.length !== 1) return;
      touchStartX = evt.touches[0].clientX;
      touchMoved = false;
      card.classList.add("chronos-dragging");
      evt.preventDefault();
    }, { passive: false });

    card.addEventListener("touchmove", (evt) => {
      if (evt.touches.length !== 1) return;
      const deltaX = evt.touches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 5) {
        touchMoved = true;
        card.style.transform = `translateX(${deltaX}px)`;
      }
      evt.preventDefault();
    }, { passive: false });

    card.addEventListener("touchend", (evt) => {
      card.classList.remove("chronos-dragging");
      card.style.transform = "";
      if (touchMoved && evt.changedTouches.length === 1) {
        const deltaX = evt.changedTouches[0].clientX - touchStartX;
        onTouchDrag(note, deltaX);
      }
    });
  }

  return card;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(d: Date): string {
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  const absDays = Math.abs(diffDays);

  if (absDays < 7) {
    return diffDays > 0 ? `In ${absDays} days` : `${absDays} days ago`;
  }
  if (absDays < 30) {
    const weeks = Math.round(absDays / 7);
    return diffDays > 0 ? `In ${weeks}w` : `${weeks}w ago`;
  }
  if (absDays < 365) {
    const months = Math.round(absDays / 30);
    return diffDays > 0 ? `In ${months}mo` : `${months}mo ago`;
  }
  const years = Math.round(absDays / 365);
  return diffDays > 0 ? `In ${years}y` : `${years}y ago`;
}
