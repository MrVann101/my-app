import { z } from "zod";
import { recipeNutritionSchema } from "@/lib/recipe-schemas";

export const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const weeklyMealAiSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  nutrition: recipeNutritionSchema,
});

export const weeklyPlanPreferencesSchema = z.object({
  dailyCalorieTarget: z.number().int().min(800).max(6000),
  mealsPerDay: z.number().int().min(2).max(6),
  preferredFoods: z.array(z.string().trim().min(1).max(80)).max(12),
  foodRestrictions: z.array(z.string().trim().min(1).max(80)).max(12),
});

export const weeklyPlanMealSchema = weeklyMealAiSchema.extend({
  servings: z.number().finite().min(0.25).max(12),
});

export const weeklyPlanDaySchema = z.object({
  day: z.enum(WEEK_DAYS),
  meals: z.array(weeklyPlanMealSchema).min(2).max(6),
});

export const weeklyPlanScheduleSchema = z.array(weeklyPlanDaySchema).length(7).refine(
  (days) => days.every((day, index) => day.day === WEEK_DAYS[index]),
  "Schedule days must run Monday through Sunday.",
);

export const weeklyPlanSaveSchema = z.object({
  name: z.string().trim().min(1).max(100),
  preferences: weeklyPlanPreferencesSchema,
  days: weeklyPlanScheduleSchema,
});

export const weeklyPlanRecordSchema = weeklyPlanSaveSchema.extend({
  id: z.number().int().positive(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const weeklyPlanUpdateSchema = weeklyPlanSaveSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be updated.",
);

export const weeklyPlanGenerationRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("week"),
    preferences: weeklyPlanPreferencesSchema,
  }),
  z.object({
    action: z.literal("day"),
    preferences: weeklyPlanPreferencesSchema,
    day: z.enum(WEEK_DAYS),
  }),
  z.object({
    action: z.literal("meal"),
    preferences: weeklyPlanPreferencesSchema,
    day: z.enum(WEEK_DAYS),
    slot: z.string().trim().min(1).max(30),
    currentTitle: z.string().trim().min(1).max(120),
  }),
]);

export type WeeklyPlanPreferences = z.infer<typeof weeklyPlanPreferencesSchema>;
export type WeeklyPlanMeal = z.infer<typeof weeklyPlanMealSchema>;
export type WeeklyPlanDay = z.infer<typeof weeklyPlanDaySchema>;
export type WeeklyPlanSchedule = z.infer<typeof weeklyPlanScheduleSchema>;
export type WeeklyPlan = z.infer<typeof weeklyPlanRecordSchema>;

export function getMealSlotLabel(mealsPerDay: number, index: number) {
  const slots = mealsPerDay === 2
    ? ["Breakfast", "Dinner"]
    : ["Breakfast", "Lunch", "Dinner", "Snack 1", "Snack 2", "Snack 3"];
  return slots[index] ?? `Meal ${index + 1}`;
}

export function parsePreferenceList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}
