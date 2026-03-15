import { TFile, CachedMetadata } from "obsidian";
import { ChronosSettings } from "../types";

/**
 * Attempts to parse a value into a valid Date.
 * Handles ISO strings, YYYY-MM-DD, DD/MM/YYYY, timestamps, etc.
 */
export function parseDate(value: unknown): Date | null {
  if (value == null) return null;

  // Already a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Number timestamp (ms)
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  // ISO 8601 and YYYY-MM-DD  (most common in frontmatter)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // MM/DD/YYYY (US format)
  const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const d = new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Natural language fallback (e.g. "January 5, 2024")
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Extracts the best date for a file using the configured priority list.
 * Returns { date, fieldUsed } or null if nothing found.
 */
export function extractDate(
  file: TFile,
  cache: CachedMetadata | null,
  settings: ChronosSettings
): { date: Date; fieldUsed: string } | null {
  const fm = cache?.frontmatter;

  if (fm) {
    for (const field of settings.dateFields) {
      if (Object.prototype.hasOwnProperty.call(fm, field)) {
        const parsed = parseDate(fm[field]);
        if (parsed) return { date: parsed, fieldUsed: field };
      }
    }
  }

  if (settings.useFallbackCtime) {
    const d = new Date(file.stat.ctime);
    if (!isNaN(d.getTime())) return { date: d, fieldUsed: "ctime" };
  }

  return null;
}
