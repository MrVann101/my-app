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

export const WEEK_DAY_INDEX: Record<(typeof WEEK_DAYS)[number], number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

export const weeklyMealAiSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  nutrition: recipeNutritionSchema,
  ingredients: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
});

export const weeklyPlanPreferencesSchema = z.object({
  dailyCalorieTarget: z.number().int().min(800).max(6000),
  mealsPerDay: z.number().int().min(2).max(6),
  preferredFoods: z.array(z.string().trim().min(1).max(80)).max(12),
  foodRestrictions: z.array(z.string().trim().min(1).max(80)).max(12),
});

export const weeklyPlanMealSchema = weeklyMealAiSchema.extend({
  id: z.number().int().positive().optional(),
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

export const weeklyPlanSummarySchema = z.object({
  avgDailyCalories: z.number().int().nonnegative(),
  avgDailyProteinG: z.number().int().nonnegative(),
  avgDailyCarbsG: z.number().int().nonnegative(),
  avgDailyFatG: z.number().int().nonnegative(),
  totalMeals: z.number().int().nonnegative(),
});

export const weeklyPlanGroceryStateSchema = z.object({
  checked: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
  custom: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

export type WeeklyPlanGroceryState = z.infer<typeof weeklyPlanGroceryStateSchema>;

export const EMPTY_GROCERY_STATE: WeeklyPlanGroceryState = { checked: [], custom: [] };

export const weeklyPlanSaveSchema = z.object({
  name: z.string().trim().min(1).max(100),
  preferences: weeklyPlanPreferencesSchema,
  days: weeklyPlanScheduleSchema,
  isActive: z.boolean().optional(),
  groceryState: weeklyPlanGroceryStateSchema.optional(),
});

export const weeklyPlanRecordSchema = weeklyPlanSaveSchema.extend({
  id: z.number().int().positive(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  summary: weeklyPlanSummarySchema.optional(),
});

export const weeklyPlanUpdateSchema = weeklyPlanSaveSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be updated.",
);

export const weeklyPlanGenerationRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("week"),
    preferences: weeklyPlanPreferencesSchema,
    excludeTitles: z.array(z.string().trim().min(1).max(120)).max(24).optional(),
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

export const weeklyPlanMealRowSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  weekly_plan_id: z.coerce.number().int().positive().optional(),
  day_of_week: z.coerce.number().int().min(1).max(7),
  day_name: z.enum(WEEK_DAYS).optional(),
  slot_index: z.coerce.number().int().min(0).max(5),
  meal_slot: z.string().trim().min(1).max(30).optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(240).optional().default(""),
  servings: z.coerce.number().finite().min(0.25).max(12),
  calories_per_serving: z.coerce.number().finite().nonnegative().max(5000),
  protein_g_per_serving: z.coerce.number().finite().nonnegative().max(500),
  carbs_g_per_serving: z.coerce.number().finite().nonnegative().max(1000),
  fat_g_per_serving: z.coerce.number().finite().nonnegative().max(500),
});

export type WeeklyPlanPreferences = z.infer<typeof weeklyPlanPreferencesSchema>;
export type WeeklyPlanMeal = z.infer<typeof weeklyPlanMealSchema>;
export type WeeklyPlanDay = z.infer<typeof weeklyPlanDaySchema>;
export type WeeklyPlanSchedule = z.infer<typeof weeklyPlanScheduleSchema>;
export type WeeklyPlanSummary = z.infer<typeof weeklyPlanSummarySchema>;
export type WeeklyPlan = z.infer<typeof weeklyPlanRecordSchema>;
export type WeeklyPlanMealRow = z.infer<typeof weeklyPlanMealRowSchema>;

export function getMealSlotLabel(mealsPerDay: number, index: number) {
  const slots = mealsPerDay === 2
    ? ["Breakfast", "Dinner"]
    : ["Breakfast", "Lunch", "Dinner", "Snack 1", "Snack 2", "Snack 3"];
  return slots[index] ?? `Meal ${index + 1}`;
}

export function parsePreferenceList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function isGenericSlotTitle(title: string): boolean {
  return /^(breakfast|lunch|dinner|snacks?|snack\s*\d+|meal\s*\d+)$/i.test(title.trim());
}

export function computeMealTotals(meal: WeeklyPlanMeal) {
  return {
    calories: Math.round(meal.nutrition.calories * meal.servings),
    proteinG: Math.round(meal.nutrition.proteinG * meal.servings),
    carbsG: Math.round(meal.nutrition.carbsG * meal.servings),
    fatG: Math.round(meal.nutrition.fatG * meal.servings),
  };
}

export function computeDayTotals(day: WeeklyPlanDay) {
  return day.meals.reduce(
    (acc, meal) => {
      const totals = computeMealTotals(meal);
      return {
        calories: acc.calories + totals.calories,
        proteinG: acc.proteinG + totals.proteinG,
        carbsG: acc.carbsG + totals.carbsG,
        fatG: acc.fatG + totals.fatG,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function computeWeeklySummary(days: WeeklyPlanSchedule): WeeklyPlanSummary {
  const dayCount = days.length || 7;
  const totals = days.reduce(
    (acc, day) => {
      const dayTotal = computeDayTotals(day);
      return {
        calories: acc.calories + dayTotal.calories,
        proteinG: acc.proteinG + dayTotal.proteinG,
        carbsG: acc.carbsG + dayTotal.carbsG,
        fatG: acc.fatG + dayTotal.fatG,
        totalMeals: acc.totalMeals + day.meals.length,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, totalMeals: 0 },
  );

  return {
    avgDailyCalories: Math.round(totals.calories / dayCount),
    avgDailyProteinG: Math.round(totals.proteinG / dayCount),
    avgDailyCarbsG: Math.round(totals.carbsG / dayCount),
    avgDailyFatG: Math.round(totals.fatG / dayCount),
    totalMeals: totals.totalMeals,
  };
}

export function serializeWeeklyPlanMeals(weeklyPlanId: number, days: WeeklyPlanSchedule) {
  return days.flatMap((day) => {
    const dayOfWeek = WEEK_DAY_INDEX[day.day];
    return day.meals.map((meal, slotIndex) => ({
      weekly_plan_id: weeklyPlanId,
      day_of_week: dayOfWeek,
      day_name: day.day,
      slot_index: slotIndex,
      meal_slot: getMealSlotLabel(day.meals.length, slotIndex),
      title: meal.title,
      description: meal.description,
      servings: meal.servings,
      calories_per_serving: meal.nutrition.calories,
      protein_g_per_serving: meal.nutrition.proteinG,
      carbs_g_per_serving: meal.nutrition.carbsG,
      fat_g_per_serving: meal.nutrition.fatG,
    }));
  });
}

export function hydrateWeeklyPlanDays(
  mealRows: readonly unknown[] | null | undefined,
  fallbackDays: unknown,
): WeeklyPlanSchedule {
  if (Array.isArray(mealRows) && mealRows.length > 0) {
    const parsedRows = z.array(weeklyPlanMealRowSchema).safeParse(mealRows);
    if (parsedRows.success) {
      const byDay = new Map<number, WeeklyPlanMealRow[]>();
      for (const row of parsedRows.data) {
        const list = byDay.get(row.day_of_week) ?? [];
        list.push(row);
        byDay.set(row.day_of_week, list);
      }

      const fallbackIngredients = new Map<string, string[]>();
      if (Array.isArray(fallbackDays)) {
        for (const rawDay of fallbackDays) {
          if (!isPlainRecord(rawDay) || typeof rawDay.day !== "string" || !Array.isArray(rawDay.meals)) continue;
          rawDay.meals.forEach((rawMeal, idx) => {
            if (!isPlainRecord(rawMeal) || !Array.isArray(rawMeal.ingredients)) return;
            const validIngredients = rawMeal.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
            if (validIngredients.length > 0) {
              fallbackIngredients.set(`${rawDay.day}-${idx}`, validIngredients);
            }
          });
        }
      }

      const candidate = WEEK_DAYS.map((day, idx) => {
        const rows = [...(byDay.get(idx + 1) ?? [])].sort((a, b) => a.slot_index - b.slot_index);
        return {
          day,
          meals: rows.map((row) => {
            const preservedIngredients = fallbackIngredients.get(`${day}-${row.slot_index}`);
            return {
              ...(row.id ? { id: row.id } : {}),
              title: row.title,
              description: row.description.trim() || "Planned meal.",
              nutrition: {
                calories: row.calories_per_serving,
                proteinG: row.protein_g_per_serving,
                carbsG: row.carbs_g_per_serving,
                fatG: row.fat_g_per_serving,
              },
              ...(preservedIngredients ? { ingredients: preservedIngredients } : {}),
              servings: row.servings,
            };
          }),
        };
      });

      const validated = weeklyPlanScheduleSchema.safeParse(candidate);
      if (validated.success) return validated.data;
    }
  }

  return weeklyPlanScheduleSchema.parse(fallbackDays);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hydrateWeeklyPlanRecord(rawRow: unknown): WeeklyPlan {
  if (!isPlainRecord(rawRow)) {
    throw new Error("Invalid weekly plan record.");
  }

  const structuredPreferences = {
    dailyCalorieTarget:
      typeof rawRow.daily_calorie_target === "number" ? rawRow.daily_calorie_target : 2000,
    mealsPerDay: typeof rawRow.meals_per_day === "number" ? rawRow.meals_per_day : 3,
    preferredFoods: Array.isArray(rawRow.preferred_foods) ? rawRow.preferred_foods : [],
    foodRestrictions: Array.isArray(rawRow.food_restrictions) ? rawRow.food_restrictions : [],
  };

  const parsedPreferences = weeklyPlanPreferencesSchema.safeParse(rawRow.preferences);
  const preferences = parsedPreferences.success
    ? parsedPreferences.data
    : weeklyPlanPreferencesSchema.parse(structuredPreferences);

  const days = hydrateWeeklyPlanDays(
    Array.isArray(rawRow.weekly_plan_meals) ? rawRow.weekly_plan_meals : undefined,
    rawRow.days,
  );

  const parsedGroceryState =
    rawRow.grocery_state !== undefined
      ? weeklyPlanGroceryStateSchema.safeParse(rawRow.grocery_state)
      : null;

  const nowIso = new Date().toISOString();
  const createdAt = typeof rawRow.created_at === "string" ? rawRow.created_at : nowIso;
  const updatedAt = typeof rawRow.updated_at === "string" ? rawRow.updated_at : createdAt;

  return {
    id: Number(rawRow.id),
    name: String(rawRow.name ?? "My Weekly Plan"),
    preferences,
    days,
    created_at: createdAt,
    updated_at: updatedAt,
    ...(typeof rawRow.is_active === "boolean" ? { isActive: rawRow.is_active } : {}),
    ...(parsedGroceryState?.success ? { groceryState: parsedGroceryState.data } : {}),
    summary: computeWeeklySummary(days),
  };
}
