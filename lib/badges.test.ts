import { describe, expect, it } from "vitest";
import { badgesForProgress } from "./badges";

describe("badgesForProgress", () => {
  it("returns each earned badge once", () => {
    const badges = badgesForProgress(10, 7);
    expect(badges.map((badge) => badge.badgeKey)).toEqual(["first_log", "ten_logs", "seven_day_streak"]);
    expect(new Set(badges.map((badge) => badge.badgeKey)).size).toBe(badges.length);
  });

  it("does not award progress badges before their thresholds", () => {
    expect(badgesForProgress(0, 0)).toEqual([]);
    expect(badgesForProgress(9, 6).map((badge) => badge.badgeKey)).toEqual(["first_log"]);
  });
});