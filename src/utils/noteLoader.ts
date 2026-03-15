import { App, TFile } from "obsidian";
import { ChronosSettings, TimelineNote, LaneOccupancy, ZOOM_PX_PER_DAY, ZoomLevel } from "../types";
import { extractDate } from "./dateParser";

/** Palette of default colors for folders / tags without explicit colors */
const DEFAULT_PALETTE = [
  "#4f8ef7", "#e05c5c", "#48b883", "#e8a838",
  "#8e6fdb", "#3ec9c9", "#e87b3e", "#8ab83e",
];

function getDefaultColor(key: string, palette = DEFAULT_PALETTE): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function resolveColor(note: TimelineNote, settings: ChronosSettings): string {
  if (settings.colorBy === "tag" && note.tags.length > 0) {
    const tag = note.tags[0];
    return settings.tagColors[tag] ?? getDefaultColor(tag);
  }
  if (settings.colorBy === "folder") {
    return settings.folderColors[note.folder] ?? getDefaultColor(note.folder || "root");
  }
  return "#4f8ef7";
}

/**
 * Loads all eligible markdown files from the vault and returns
 * TimelineNote objects, sorted by date ascending.
 * Excludes files in `settings.excludeFolders`.
 */
export function loadNotes(app: App, settings: ChronosSettings): TimelineNote[] {
  const files = app.vault.getMarkdownFiles();
  const notes: TimelineNote[] = [];

  for (const file of files) {
    if (isExcluded(file, settings)) continue;

    const cache = app.metadataCache.getFileCache(file);
    const result = extractDate(file, cache, settings);
    if (!result) continue;

    const rawTags: unknown = cache?.frontmatter?.tags ?? [];
    let normalizedTags: string[] = [];
    if (Array.isArray(rawTags)) {
      normalizedTags = rawTags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.replace(/^#/, ""));
    } else if (typeof rawTags === "string") {
      normalizedTags = [rawTags.replace(/^#/, "")];
    }

    const folder = file.parent?.path ?? "";

    const note: TimelineNote = {
      path: file.path,
      title: file.basename,
      date: result.date,
      dateFieldUsed: result.fieldUsed,
      tags: normalizedTags,
      folder,
      color: "#4f8ef7",
      laneIndex: 0,
    };
    note.color = resolveColor(note, settings);
    notes.push(note);
  }

  notes.sort((a, b) => a.date.getTime() - b.date.getTime());
  return notes;
}

function isExcluded(file: TFile, settings: ChronosSettings): boolean {
  for (const excluded of settings.excludeFolders) {
    const normalized = excluded.endsWith("/") ? excluded : excluded + "/";
    if (file.path.startsWith(normalized) || file.parent?.path === excluded) {
      return true;
    }
  }
  return false;
}

/**
 * Assigns a laneIndex to each note using a greedy sweep-line algorithm.
 * Notes in the same horizontal time-slot get different lanes (rows).
 * Modifies the notes array in place.
 */
export function assignLanes(
  notes: TimelineNote[],
  viewStartDate: Date,
  zoom: ZoomLevel,
  cardWidthPx: number,
  maxLanes: number
): void {
  const pxPerDay = ZOOM_PX_PER_DAY[zoom];
  const cardPaddingPx = 8;
  const effectiveCardWidth = cardWidthPx + cardPaddingPx;

  // Each lane tracks the rightmost X position that is already occupied
  const laneEndX: LaneOccupancy[] = [];

  for (const note of notes) {
    const dayOffset = (note.date.getTime() - viewStartDate.getTime()) / 86_400_000;
    const noteX = dayOffset * pxPerDay;

    // Find the first lane where this card fits
    let assignedLane = -1;
    for (let i = 0; i < laneEndX.length; i++) {
      if (laneEndX[i].endX <= noteX) {
        assignedLane = i;
        laneEndX[i].endX = noteX + effectiveCardWidth;
        break;
      }
    }

    if (assignedLane === -1 && laneEndX.length < maxLanes) {
      assignedLane = laneEndX.length;
      laneEndX.push({ endX: noteX + effectiveCardWidth });
    }

    // If all lanes are full, overflow into the last lane
    if (assignedLane === -1) {
      assignedLane = maxLanes - 1;
    }

    note.laneIndex = assignedLane;
  }
}
