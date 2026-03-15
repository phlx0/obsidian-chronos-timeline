import { describe, it, expect } from "vitest";
import { formatDateForFrontmatter } from "../utils/frontmatterEditor";

describe("formatDateForFrontmatter", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const d = new Date(2024, 2, 15); // March 15, 2024 (local)
    const result = formatDateForFrontmatter(d);
    expect(result).toBe("2024-03-15");
  });

  it("zero-pads month and day", () => {
    const d = new Date(2024, 0, 5); // Jan 5
    const result = formatDateForFrontmatter(d);
    expect(result).toBe("2024-01-05");
  });

  it("handles year 2000 and later correctly", () => {
    const d = new Date(2000, 11, 31); // Dec 31, 2000
    const result = formatDateForFrontmatter(d);
    expect(result).toBe("2000-12-31");
  });

  it("handles end of year boundary", () => {
    const d = new Date(2023, 11, 31); // Dec 31, 2023
    expect(formatDateForFrontmatter(d)).toBe("2023-12-31");
  });
});
