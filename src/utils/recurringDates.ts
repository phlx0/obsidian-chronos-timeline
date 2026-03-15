import { RecurrenceType } from "../types";

export type { RecurrenceType };

export function isValidRecurrence(value: unknown): value is RecurrenceType {
  return (
    typeof value === "string" &&
    ["daily", "weekly", "biweekly", "monthly", "yearly"].includes(value)
  );
}

/**
 * Returns all occurrences of a recurring event within [rangeStart, rangeEnd],
 * excluding the original baseDate itself.
 */
export function generateRecurringDates(
  baseDate: Date,
  recurrence: RecurrenceType,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const dates: Date[] = [];

  // Walk forward from baseDate
  let cur = new Date(baseDate);
  let iterations = 0;
  const MAX_ITER = 1000;

  while (cur <= rangeEnd && iterations < MAX_ITER) {
    iterations++;
    cur = advance(cur, recurrence);
    if (cur >= rangeStart && cur <= rangeEnd) {
      dates.push(new Date(cur));
    }
  }

  // Walk backward from baseDate
  cur = new Date(baseDate);
  iterations = 0;
  while (cur >= rangeStart && iterations < MAX_ITER) {
    iterations++;
    cur = retreat(cur, recurrence);
    if (cur >= rangeStart && cur <= rangeEnd) {
      dates.push(new Date(cur));
    }
  }

  return dates;
}

export function advance(date: Date, recurrence: RecurrenceType): Date {
  const d = new Date(date);
  switch (recurrence) {
    case "daily":    d.setDate(d.getDate() + 1); break;
    case "weekly":   d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly":  d.setMonth(d.getMonth() + 1); break;
    case "yearly":   d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export function retreat(date: Date, recurrence: RecurrenceType): Date {
  const d = new Date(date);
  switch (recurrence) {
    case "daily":    d.setDate(d.getDate() - 1); break;
    case "weekly":   d.setDate(d.getDate() - 7); break;
    case "biweekly": d.setDate(d.getDate() - 14); break;
    case "monthly":  d.setMonth(d.getMonth() - 1); break;
    case "yearly":   d.setFullYear(d.getFullYear() - 1); break;
  }
  return d;
}
