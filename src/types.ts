export type ZoomLevel = "year" | "month" | "week" | "day";
export type ViewMode = "timeline" | "heatmap";

export interface TimelineNote {
  path: string;
  title: string;
  date: Date;
  dateFieldUsed: string;
  tags: string[];
  folder: string;
  topLevelFolder: string;
  color: string;
  laneIndex: number;
  wordCount: number;
}

export interface SwimlaneGroup {
  label: string;
  notes: TimelineNote[];
  yOffset: number;
  height: number;
}

export interface LaneOccupancy {
  endX: number;
}

export interface ChronosSettings {
  dateFields: string[];
  useFallbackCtime: boolean;
  defaultZoom: ZoomLevel;
  showPreviewTooltip: boolean;
  excludeFolders: string[];
  colorBy: "folder" | "tag" | "none";
  tagColors: Record<string, string>;
  folderColors: Record<string, string>;
  maxLanes: number;
  cardWidth: number;
  enableSwimlanes: boolean;
  enableMinimap: boolean;
  enableVirtualization: boolean;
  enableDragReschedule: boolean;
}

export const DEFAULT_SETTINGS: ChronosSettings = {
  dateFields: ["date", "created", "published", "meeting-date", "event-date"],
  useFallbackCtime: true,
  defaultZoom: "month",
  showPreviewTooltip: true,
  excludeFolders: [],
  colorBy: "folder",
  tagColors: {},
  folderColors: {},
  maxLanes: 8,
  cardWidth: 180,
  enableSwimlanes: false,
  enableMinimap: true,
  enableVirtualization: true,
  enableDragReschedule: true,
};

export const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  year: 4,
  month: 20,
  week: 80,
  day: 220,
};

export const SWIMLANE_HEADER_HEIGHT = 28;
export const CARD_HEIGHT_PX = 72;
export const LANE_HEIGHT_PX = 88;
export const DATE_PAD_DAYS = 30;
export const VIRT_BUFFER_PX = 600;
export const MAX_WORD_COUNT_REF = 2000;
