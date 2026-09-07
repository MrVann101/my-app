import { describe, expect, it } from "vitest";
import { calculateRecalibration, hasEnoughWeightCheckins, shouldShowRecommendation } from "./recalibration";

describe("calculateRecalibration", () => {
  const base = { firstWeightKg: 80, lastWeightKg: 80, days: 28, targetCalories: 2_000, tdee: 2_500, safetyFloor: 1_500 };

  it("suggests an increase when loss is faster than predicted", () => {
    const result = calculateRecalibration({ ...base, lastWeightKg: 77.5 });
    expect(result.direction).toBe("increase");
    expect(result.recommendedCalories).toBeGreaterThan(base.targetCalories);
  });

  it("suggests a decrease when weight rises beyond the predicted trend", () => {
    const result = calculateRecalibration({ ...base, lastWeightKg: 81.2 });
    expect(result.direction).toBe("decrease");
    expect(result.recommendedCalories).toBeLessThan(base.targetCalories);
  });

  it("keeps matching trends unchanged and respects the safety floor", () => {
    expect(calculateRecalibration({ ...base, lastWeightKg: 78.18 }).direction).toBe("none");
    const result = calculateRecalibration({ ...base, targetCalories: 1_550, lastWeightKg: 81.2 });
    expect(result.recommendedCalories).toBeGreaterThanOrEqual(base.safetyFloor);
  });

  it("requires three check-ins and does not repeat the same recommendation", () => {
    expect(hasEnoughWeightCheckins(2)).toBe(false);
    expect(hasEnoughWeightCheckins(3)).toBe(true);
    expect(shouldShowRecommendation("increase", 2100, 2100)).toBe(false);
    expect(shouldShowRecommendation("increase", 2000, 2100)).toBe(true);
  });
});
