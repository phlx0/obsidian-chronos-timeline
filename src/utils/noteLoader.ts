import { App, TFile } from "obsidian";
import {
  ChronosSettings,
  TimelineNote,
  LaneOccupancy,
  ZOOM_PX_PER_DAY,
  ZoomLevel,
  CARD_HEIGHT_PX,
  LANE_HEIGHT_PX,
  SWIMLANE_HEADER_HEIGHT,
  SwimlaneGroup,
} from "../types";
import { extractDate } from "./dateParser";

const DEFAULT_PALETTE = [
  "#4f8ef7", "#e05c5c", "#48b883", "#e8a838",
  "#8e6fdb", "#3ec9c9", "#e87b3e", "#8ab83e",
];

function getDefaultColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return DEFAULT_PALETTE[Math.abs(hash) % DEFAULT_PALETTE.length];
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

function getTopLevelFolder(folder: string): string {
  if (!folder) return "(root)";
  return folder.split("/")[0] || "(root)";
}

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
      topLevelFolder: getTopLevelFolder(folder),
      color: "#4f8ef7",
      laneIndex: 0,
      // Use file size in bytes / 6 as a fast word-count proxy
      wordCount: Math.round(file.stat.size / 6),
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
 * Assigns laneIndex to each note using a greedy sweep-line algorithm.
 * Operates on a flat array — call once per swimlane group when using swimlanes.
 */
export function assignLanes(
  notes: TimelineNote[],
  viewStartDate: Date,
  zoom: ZoomLevel,
  cardWidthPx: number,
  maxLanes: number
): void {
  const pxPerDay = ZOOM_PX_PER_DAY[zoom];
  const effectiveCardWidth = cardWidthPx + 8;
  const laneEndX: LaneOccupancy[] = [];

  for (const note of notes) {
    const dayOffset = (note.date.getTime() - viewStartDate.getTime()) / 86_400_000;
    const noteX = dayOffset * pxPerDay;

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

    if (assignedLane === -1) assignedLane = maxLanes - 1;

    note.laneIndex = assignedLane;
  }
}

/**
 * Groups notes into swimlane definitions, assigns per-group lanes,
 * and computes cumulative Y offsets for rendering.
 */
export function buildSwimlaneGroups(
  notes: TimelineNote[],
  viewStartDate: Date,
  zoom: ZoomLevel,
  cardWidthPx: number,
  maxLanes: number
): SwimlaneGroup[] {
  const groupMap = new Map<string, TimelineNote[]>();
  for (const note of notes) {
    const key = note.topLevelFolder;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(note);
  }

  const groups: SwimlaneGroup[] = [];
  let yOffset = 0;

  for (const [label, groupNotes] of groupMap) {
    assignLanes(groupNotes, viewStartDate, zoom, cardWidthPx, maxLanes);
    const maxLane = Math.max(...groupNotes.map((n) => n.laneIndex), 0);
    const height = (maxLane + 1) * LANE_HEIGHT_PX + SWIMLANE_HEADER_HEIGHT + 16;
    groups.push({ label, notes: groupNotes, yOffset, height });
    yOffset += height;
  }

  return groups;
}
