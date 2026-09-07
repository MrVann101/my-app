import { describe, expect, it } from "vitest";
import { buildWeeklySummary } from "./weekly-summary";

describe("buildWeeklySummary", () => {
  it("creates a deterministic summary from permanent daily rows", () => {
    const result = buildWeeklySummary([
      { total_calories: 2000, calories_burned: 300, total_protein_g: 120, hit_target: true, logged_at_least_once: true },
      { total_calories: 1800, calories_burned: 0, total_protein_g: 100, hit_target: false, logged_at_least_once: true },
    ]);
    expect(result.daysTracked).toBe(2);
    expect(result.averageCalories).toBe(1900);
    expect(result.averageNetCalories).toBe(1750);
    expect(result.targetHitDays).toBe(1);
  });

  it("returns a useful fallback when no days are logged", () => {
    expect(buildWeeklySummary([]).summary).toContain("No logged days yet");
  });
});
