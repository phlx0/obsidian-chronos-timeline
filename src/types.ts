export type ZoomLevel = "year" | "month" | "week" | "day";

export interface TimelineNote {
  path: string;
  title: string;
  date: Date;
  dateFieldUsed: string;
  tags: string[];
  folder: string;
  color: string;
  laneIndex: number;
}

export interface LaneOccupancy {
  endX: number;
}

export interface ChronosSettings {
  /** Frontmatter fields to scan for dates, in priority order */
  dateFields: string[];
  /** Fall back to file's ctime if no frontmatter date found */
  useFallbackCtime: boolean;
  /** Default zoom level when opening the view */
  defaultZoom: ZoomLevel;
  /** Show a content preview tooltip on hover */
  showPreviewTooltip: boolean;
  /** Folders to exclude (exact path prefixes) */
  excludeFolders: string[];
  /** Color strategy for note cards */
  colorBy: "folder" | "tag" | "none";
  /** Map of tag → hex color */
  tagColors: Record<string, string>;
  /** Map of folder path → hex color */
  folderColors: Record<string, string>;
  /** Maximum number of lanes (rows) in the timeline */
  maxLanes: number;
  /** Card width in pixels */
  cardWidth: number;
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
};

/** Pixels represented by one day at each zoom level */
export const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  year: 4,
  month: 20,
  week: 80,
  day: 220,
};
