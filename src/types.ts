export type ZoomLevel = "year" | "month" | "week" | "day";
export type ViewMode = "timeline" | "heatmap";
export type RecurrenceType = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface TimelineNote {
  path: string;
  title: string;
  date: Date;
  endDate?: Date;           // Gantt — end date
  dateFieldUsed: string;
  tags: string[];
  folder: string;
  topLevelFolder: string;
  color: string;
  laneIndex: number;
  wordCount: number;
  isRecurring?: boolean;   // ghost copy of a recurring note
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

export interface SerializableFilters {
  tags: string[];
  folders: string[];
  searchQuery: string;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface ChronosSettings {
  // Date detection
  dateFields: string[];
  useFallbackCtime: boolean;
  // Display
  defaultZoom: ZoomLevel;
  showPreviewTooltip: boolean;
  cardWidth: number;
  maxLanes: number;
  showRelativeDates: boolean;
  showColorLegend: boolean;
  // Features
  enableSwimlanes: boolean;
  enableMinimap: boolean;
  enableVirtualization: boolean;
  enableDragReschedule: boolean;
  enablePreviewPanel: boolean;
  persistFilters: boolean;
  // Gantt
  enableGantt: boolean;
  ganttEndField: string;
  // Recurring
  enableRecurring: boolean;
  recurringField: string;
  // Dataview
  dataviewQuery: string;
  // Colors
  colorBy: "folder" | "tag" | "none";
  tagColors: Record<string, string>;
  folderColors: Record<string, string>;
  // Filters
  excludeFolders: string[];
}

export const DEFAULT_SETTINGS: ChronosSettings = {
  dateFields: ["date", "created", "published", "meeting-date", "event-date"],
  useFallbackCtime: true,
  defaultZoom: "month",
  showPreviewTooltip: true,
  cardWidth: 180,
  maxLanes: 8,
  showRelativeDates: false,
  showColorLegend: true,
  enableSwimlanes: false,
  enableMinimap: true,
  enableVirtualization: true,
  enableDragReschedule: true,
  enablePreviewPanel: true,
  persistFilters: true,
  enableGantt: false,
  ganttEndField: "end-date",
  enableRecurring: false,
  recurringField: "recurrence",
  dataviewQuery: "",
  colorBy: "folder",
  tagColors: {},
  folderColors: {},
  excludeFolders: [],
};

export const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  year: 4,
  month: 20,
  week: 80,
  day: 220,
};

export const ZOOM_ORDER: ZoomLevel[] = ["year", "month", "week", "day"];
export const SWIMLANE_HEADER_HEIGHT = 28;
export const CARD_HEIGHT_PX = 72;
export const LANE_HEIGHT_PX = 88;
export const DATE_PAD_DAYS = 30;
export const VIRT_BUFFER_PX = 600;
export const MAX_WORD_COUNT_REF = 2000;
export const MS_PER_DAY = 86_400_000;
export const DOUBLE_CLICK_MS = 240;
export const TOUCH_DEAD_ZONE_PX = 5;
export const TOUCH_LONG_PRESS_MS = 400;
export const VIRT_THRESHOLD = 150;
