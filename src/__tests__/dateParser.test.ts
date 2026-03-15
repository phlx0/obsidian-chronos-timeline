import { describe, it, expect } from "vitest";
import { parseDate } from "../utils/dateParser";

describe("parseDate", () => {
  it("parses ISO date string", () => {
    const d = parseDate("2024-03-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2); // March (0-indexed)
    expect(d!.getDate()).toBe(15);
  });

  it("parses ISO datetime string", () => {
    const d = parseDate("2024-03-15T10:30:00");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
  });

  it("parses DD/MM/YYYY", () => {
    const d = parseDate("15/03/2024");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(15);
  });

  it("parses ambiguous MM/DD/YYYY as DD/MM/YYYY (parser prefers DMY)", () => {
    // The parser tries DD/MM/YYYY first; 03/15/2024 → month=15 (invalid) → returns null
    // Users should use ISO YYYY-MM-DD format for unambiguous dates
    expect(parseDate("03/15/2024")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it("returns null for invalid date strings", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });

  it("handles Date objects", () => {
    const now = new Date("2024-06-01");
    const d = parseDate(now);
    expect(d).not.toBeNull();
    expect(d!.getTime()).toBe(now.getTime());
  });

  it("handles numeric timestamps", () => {
    const ts = new Date("2024-01-15").getTime();
    const d = parseDate(ts);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
  });
});
