import { describe, expect, it } from "vitest";
import { currentStreakForDate, updateStreak } from "@/lib/streaks";

describe("streak transitions", () => {
  it("starts a streak from the first logged day", () => {
    expect(updateStreak({ currentStreak: 0, longestStreak: 0, lastLogDate: null }, "2026-09-07")).toEqual({ currentStreak: 1, longestStreak: 1, lastLogDate: "2026-09-07" });
  });

  it("increments when logging the following day", () => {
    expect(updateStreak({ currentStreak: 3, longestStreak: 5, lastLogDate: "2026-09-06" }, "2026-09-07")).toEqual({ currentStreak: 4, longestStreak: 5, lastLogDate: "2026-09-07" });
  });

  it("does not change for another log on the same day", () => {
    const state = { currentStreak: 4, longestStreak: 5, lastLogDate: "2026-09-07" };
    expect(updateStreak(state, "2026-09-07")).toEqual(state);
  });

  it("resets after a skipped day and updates the longest streak when needed", () => {
    expect(updateStreak({ currentStreak: 8, longestStreak: 8, lastLogDate: "2026-09-01" }, "2026-09-07")).toEqual({ currentStreak: 1, longestStreak: 8, lastLogDate: "2026-09-07" });
  });

  it("keeps a streak through the day after the last log", () => {
    expect(currentStreakForDate({ currentStreak: 4, longestStreak: 5, lastLogDate: "2026-09-06" }, "2026-09-07")).toBe(4);
  });

  it("resets the displayed streak after a full day without logging", () => {
    expect(currentStreakForDate({ currentStreak: 4, longestStreak: 5, lastLogDate: "2026-09-06" }, "2026-09-08")).toBe(0);
  });
});
