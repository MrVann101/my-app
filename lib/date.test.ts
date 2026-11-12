import { describe, expect, it } from "vitest";
import { dateInTimezone } from "./date";

describe("dateInTimezone", () => {
  it("uses the requested local date instead of the UTC date", () => {
    expect(dateInTimezone(new Date("2026-10-30T23:30:00.000Z"), "Asia/Manila")).toBe("2026-10-31");
  });
});
