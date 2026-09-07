export type RecalibrationInput = {
  firstWeightKg: number;
  lastWeightKg: number;
  days: number;
  targetCalories: number;
  tdee: number;
  safetyFloor: number;
};

export type RecalibrationResult = {
  actualWeeklyChangeKg: number;
  expectedWeeklyChangeKg: number;
  divergenceKg: number;
  adjustmentCalories: number;
  recommendedCalories: number;
  direction: "increase" | "decrease" | "none";
};

export const MIN_RECALIBRATION_CHECKINS = 3;

export function hasEnoughWeightCheckins(checkinCount: number): boolean {
  return Number.isInteger(checkinCount) && checkinCount >= MIN_RECALIBRATION_CHECKINS;
}

export function shouldShowRecommendation(direction: RecalibrationResult["direction"], previousRecommendedCalories: number | null, nextRecommendedCalories: number): boolean {
  return direction !== "none" && previousRecommendedCalories !== nextRecommendedCalories;
}

export function calculateRecalibration(input: RecalibrationInput): RecalibrationResult {
  const actualWeeklyChangeKg = (input.lastWeightKg - input.firstWeightKg) / Math.max(input.days, 1) * 7;
  const expectedWeeklyChangeKg = (input.targetCalories - input.tdee) / 7700 * 7;
  const divergenceKg = actualWeeklyChangeKg - expectedWeeklyChangeKg;
  const adjustmentCalories = Math.min(200, Math.max(100, Math.round(Math.abs(divergenceKg) * 7700 / 7 / 100) * 100));
  const needsIncrease = divergenceKg < -0.15;
  const needsDecrease = divergenceKg > 0.15;
  const direction = needsIncrease ? "increase" : needsDecrease ? "decrease" : "none";
  const recommendedCalories = direction === "increase"
    ? Math.max(input.safetyFloor, input.targetCalories + adjustmentCalories)
    : direction === "decrease"
      ? Math.max(input.safetyFloor, input.targetCalories - adjustmentCalories)
      : input.targetCalories;
  return { actualWeeklyChangeKg, expectedWeeklyChangeKg, divergenceKg, adjustmentCalories: direction === "none" ? 0 : Math.abs(recommendedCalories - input.targetCalories), recommendedCalories, direction };
}
