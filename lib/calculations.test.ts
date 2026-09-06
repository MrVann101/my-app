import { describe, expect, it } from "vitest";
import { calculateBmr, calculateTargets, normalizeOnboardingInput, onboardingSchema } from "@/lib/calculations";

describe("calorie calculations", () => {
  it("calculates the male Mifflin-St Jeor BMR", () => {
    expect(calculateBmr(80, 180, 30, "male")).toBe(1780);
  });

  it("calculates the female Mifflin-St Jeor BMR", () => {
    expect(calculateBmr(60, 165, 30, "female")).toBe(1320.25);
  });

  it("applies activity, goal, and macro calculations", () => {
    const result = calculateTargets({
      weightKg: 80,
      heightCm: 180,
      age: 30,
      sex: "male",
      activityLevel: "moderate",
      goal: "maintain",
      timezone: "Asia/Manila",
    });

    expect(result).toMatchObject({
      bmr: 1780,
      tdee: 2759,
      targetCalories: 2759,
      targetProteinG: 207,
      targetCarbsG: 276,
      targetFatG: 92,
      safetyFloorApplied: false,
    });
  });

  it("covers every activity level and goal adjustment", () => {
    const activityLevels = ["sedentary", "light", "moderate", "active", "very_active"] as const;
    const goals = ["lose", "maintain", "gain"] as const;
    const expectedAdjustments = { lose: -500, maintain: 0, gain: 500 };
    const base = { weightKg: 80, heightCm: 180, age: 30, sex: "male" as const, timezone: "UTC" };

    for (const activityLevel of activityLevels) {
      const maintain = calculateTargets({ ...base, activityLevel, goal: "maintain" });
      expect(maintain.safetyFloorApplied).toBe(false);

      for (const goal of goals) {
        const result = calculateTargets({ ...base, activityLevel, goal });
        expect(result.targetCalories).toBe(maintain.targetCalories + expectedAdjustments[goal]);
      }
    }
  });

  it("enforces the female safety floor", () => {
    const result = calculateTargets({
      weightKg: 40,
      heightCm: 140,
      age: 80,
      sex: "female",
      activityLevel: "sedentary",
      goal: "lose",
      timezone: "UTC",
    });

    expect(result.targetCalories).toBe(1200);
    expect(result.safetyFloorApplied).toBe(true);
  });

  it("enforces the male safety floor", () => {
    const result = calculateTargets({
      weightKg: 45,
      heightCm: 150,
      age: 80,
      sex: "male",
      activityLevel: "sedentary",
      goal: "lose",
      timezone: "UTC",
    });

    expect(result.targetCalories).toBe(1500);
    expect(result.safetyFloorApplied).toBe(true);
  });

  it("rejects invalid onboarding values", () => {
    expect(() => onboardingSchema.parse({
      weightKg: 0,
      heightCm: 170,
      age: 30,
      sex: "male",
      activityLevel: "moderate",
      goal: "lose",
      timezone: "UTC",
    })).toThrow();
  });

  it("normalizes metric form values and preserves the IANA timezone", () => {
    expect(normalizeOnboardingInput({
      weightKg: "72.5",
      heightCm: "175",
      age: "28",
      sex: "female",
      activityLevel: "light",
      goal: "maintain",
      timezone: "Asia/Manila",
    })).toMatchObject({ weightKg: 72.5, heightCm: 175, age: 28, timezone: "Asia/Manila" });
  });

  it("rejects an invalid IANA timezone", () => {
    expect(() => normalizeOnboardingInput({
      weightKg: "72",
      heightCm: "175",
      age: "28",
      sex: "female",
      activityLevel: "light",
      goal: "maintain",
      timezone: "Not/A_Timezone",
    })).toThrow();
  });
});
