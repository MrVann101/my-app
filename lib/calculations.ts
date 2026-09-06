import { z } from "zod";
import type { ActivityLevel, Goal, Sex } from "@/lib/types";

export const onboardingSchema = z.object({
  weightKg: z.number().finite().positive().max(700),
  heightCm: z.number().finite().positive().max(300),
  age: z.number().int().min(13).max(120),
  sex: z.enum(["male", "female"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  timezone: z.string().min(1).max(100),
});

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const goalAdjustments: Record<Goal, number> = { lose: -500, maintain: 0, gain: 500 };

export type CalorieTargets = {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  safetyFloorApplied: boolean;
};

export function normalizeOnboardingInput(input: Record<string, FormDataEntryValue | undefined>) {
  const timezone = String(input.timezone ?? "").trim();

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new z.ZodError([{ code: "custom", path: ["timezone"], message: "Invalid IANA timezone." }]);
  }

  return onboardingSchema.parse({
    weightKg: Number(input.weightKg),
    heightCm: Number(input.heightCm),
    age: Number(input.age),
    sex: input.sex,
    activityLevel: input.activityLevel,
    goal: input.goal,
    timezone,
  });
}

export function calculateBmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const sexAdjustment = sex === "male" ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
}

export function calculateTargets(input: z.input<typeof onboardingSchema>): CalorieTargets {
  const values = onboardingSchema.parse(input);
  const bmr = calculateBmr(values.weightKg, values.heightCm, values.age, values.sex);
  const tdee = bmr * activityMultipliers[values.activityLevel];
  const safetyFloor = values.sex === "female" ? 1200 : 1500;
  const calculatedTarget = tdee + goalAdjustments[values.goal];
  const targetCalories = Math.max(safetyFloor, Math.round(calculatedTarget));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    targetProteinG: Math.round((targetCalories * 0.3) / 4),
    targetCarbsG: Math.round((targetCalories * 0.4) / 4),
    targetFatG: Math.round((targetCalories * 0.3) / 9),
    safetyFloorApplied: calculatedTarget < safetyFloor,
  };
}
