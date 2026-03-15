import { describe, it, expect } from "vitest";
import {
  generateRecurringDates,
  advance,
  retreat,
  isValidRecurrence,
} from "../utils/recurringDates";

describe("isValidRecurrence", () => {
  it("accepts valid values", () => {
    expect(isValidRecurrence("daily")).toBe(true);
    expect(isValidRecurrence("weekly")).toBe(true);
    expect(isValidRecurrence("biweekly")).toBe(true);
    expect(isValidRecurrence("monthly")).toBe(true);
    expect(isValidRecurrence("yearly")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidRecurrence("hourly")).toBe(false);
    expect(isValidRecurrence("")).toBe(false);
    expect(isValidRecurrence(null)).toBe(false);
    expect(isValidRecurrence(42)).toBe(false);
  });
});

describe("advance", () => {
  it("advances daily by 1 day", () => {
    const d = new Date("2024-03-01");
    const result = advance(d, "daily");
    expect(result.toISOString().split("T")[0]).toBe("2024-03-02");
  });

  it("advances weekly by 7 days", () => {
    const d = new Date("2024-03-01");
    const result = advance(d, "weekly");
    expect(result.toISOString().split("T")[0]).toBe("2024-03-08");
  });

  it("advances biweekly by 14 days", () => {
    const d = new Date("2024-03-01");
    const result = advance(d, "biweekly");
    expect(result.toISOString().split("T")[0]).toBe("2024-03-15");
  });

  it("advances monthly by one month", () => {
    const d = new Date("2024-01-31");
    const result = advance(d, "monthly");
    // Feb 31 rolls to Mar 2 (leap year 2024 has 29 days in Feb)
    expect(result.getMonth()).toBe(2); // March
  });

  it("advances yearly by one year", () => {
    const d = new Date("2024-06-15");
    const result = advance(d, "yearly");
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // June
  });
});

describe("retreat", () => {
  it("retreats daily by 1 day", () => {
    const d = new Date("2024-03-02");
    const result = retreat(d, "daily");
    expect(result.toISOString().split("T")[0]).toBe("2024-03-01");
  });

  it("retreats weekly by 7 days", () => {
    const d = new Date("2024-03-08");
    const result = retreat(d, "weekly");
    expect(result.toISOString().split("T")[0]).toBe("2024-03-01");
  });
});

describe("generateRecurringDates", () => {
  it("generates weekly dates in a range", () => {
    const base = new Date("2024-01-01");
    const start = new Date("2024-01-01");
    const end = new Date("2024-01-29");

    const dates = generateRecurringDates(base, "weekly", start, end);
    // Should include Jan 8, 15, 22, 29 (rangeEnd Jan 29 is inclusive; base Jan 1 is excluded)
    expect(dates.length).toBe(4);
    expect(dates.map(d => d.toISOString().split("T")[0]).sort()).toEqual([
      "2024-01-08",
      "2024-01-15",
      "2024-01-22",
      "2024-01-29",
    ]);
  });

  it("generates backward dates too", () => {
    const base = new Date("2024-03-01");
    const start = new Date("2024-01-01");
    const end = new Date("2024-03-01");

    const dates = generateRecurringDates(base, "monthly", start, end);
    // Should include Feb 1 (backward), no forward dates within range before base
    expect(dates.some(d => d.getMonth() === 1 && d.getDate() === 1)).toBe(true);
  });

  it("does not exceed MAX_ITER", () => {
    const base = new Date("2024-01-01");
    const start = new Date("2020-01-01");
    const end = new Date("2030-01-01");

    // Daily for 10 years — capped at 1000 iterations forward + 1000 backward
    const dates = generateRecurringDates(base, "daily", start, end);
    expect(dates.length).toBeLessThanOrEqual(2000);
  });
});
