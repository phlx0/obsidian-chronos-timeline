import { TimelineNote } from "../types";

const CARD_HEIGHT_PX = 72;
const LANE_HEIGHT_PX = 88;

/**
 * Creates a positioned DOM element for a single note card.
 * The caller is responsible for appending it to the timeline track.
 */
export function createNoteCard(
  note: TimelineNote,
  xPx: number,
  cardWidthPx: number,
  onClick: (note: TimelineNote, evt: MouseEvent) => void,
  onHover: (note: TimelineNote, target: HTMLElement, evt: MouseEvent) => void
): HTMLElement {
  const card = document.createElement("div");
  card.className = "chronos-note-card";
  card.setAttribute("data-path", note.path);
  card.setAttribute("aria-label", note.title);

  card.style.left = `${xPx}px`;
  card.style.top = `${note.laneIndex * LANE_HEIGHT_PX + 8}px`;
  card.style.width = `${cardWidthPx}px`;
  card.style.height = `${CARD_HEIGHT_PX}px`;
  card.style.setProperty("--chronos-card-color", note.color);

  // Color accent bar on the left edge
  const accent = card.createDiv({ cls: "chronos-card-accent" });
  accent.style.backgroundColor = note.color;

  // Title
  card.createDiv({ cls: "chronos-card-title", text: note.title });

  // Date subtitle
  card.createDiv({
    cls: "chronos-card-date",
    text: formatDate(note.date),
  });

  // Tags (up to 3)
  if (note.tags.length > 0) {
    const tagsRow = card.createDiv({ cls: "chronos-card-tags" });
    note.tags.slice(0, 3).forEach((tag) => {
      tagsRow.createSpan({ cls: "chronos-card-tag", text: `#${tag}` });
    });
  }

  card.addEventListener("click", (evt) => onClick(note, evt));
  card.addEventListener("mouseenter", (evt) => onHover(note, card, evt));

  return card;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export { CARD_HEIGHT_PX, LANE_HEIGHT_PX };
