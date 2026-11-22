import { describe, expect, it } from "vitest";
import {
  WEEK_DAYS,
  computeDayTotals,
  computeMealTotals,
  computeWeeklySummary,
  getMealSlotLabel,
  hydrateWeeklyPlanDays,
  hydrateWeeklyPlanRecord,
  isGenericSlotTitle,
  serializeWeeklyPlanMeals,
  weeklyPlanGroceryStateSchema,
  weeklyPlanPreferencesSchema,
  weeklyPlanRecordSchema,
  weeklyPlanScheduleSchema,
  type WeeklyPlanDay,
} from "./weekly-plan-schemas";

const preferences = {
  dailyCalorieTarget: 2000,
  mealsPerDay: 3,
  preferredFoods: ["chicken", "rice"],
  foodRestrictions: ["no peanuts"],
};

function makeSchedule() {
  return WEEK_DAYS.map((day) => ({
    day,
    meals: Array.from({ length: 3 }, (_, index) => ({
      title: `Meal ${index + 1}`,
      description: "A balanced meal.",
      nutrition: { calories: 500, proteinG: 30, carbsG: 50, fatG: 15 },
      servings: 1,
    })),
  }));
}

describe("weekly plan schemas", () => {
  it("accepts bounded preferences and a Monday-to-Sunday schedule", () => {
    expect(weeklyPlanPreferencesSchema.parse(preferences)).toEqual(preferences);
    expect(weeklyPlanScheduleSchema.parse(makeSchedule())).toHaveLength(7);
  });

  it("rejects out-of-range preferences and incorrectly ordered days", () => {
    expect(weeklyPlanPreferencesSchema.safeParse({ ...preferences, mealsPerDay: 10 }).success).toBe(false);
    const schedule = makeSchedule();
    [schedule[0], schedule[1]] = [schedule[1], schedule[0]];
    expect(weeklyPlanScheduleSchema.safeParse(schedule).success).toBe(false);
  });

  it("labels meals as breakfast, lunch, dinner, then snacks", () => {
    expect([0, 1, 2, 3].map((index) => getMealSlotLabel(4, index))).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snack 1",
    ]);
    expect(getMealSlotLabel(2, 1)).toBe("Dinner");
  });

  it("accepts Supabase timestamps with either UTC Z or an explicit offset", () => {
    const record = {
      id: 1,
      name: "My Week",
      preferences,
      days: makeSchedule(),
      created_at: "2026-11-16T04:00:00+00:00",
      updated_at: "2026-11-16T04:00:00Z",
    };
    expect(weeklyPlanRecordSchema.parse(record)).toEqual(record);
  });

  it("computes scaled meal, day, and weekly summary nutrition totals", () => {
    const schedule = makeSchedule();
    schedule[0].meals[0] = {
      title: "Double Oats",
      description: "Extra serving oats.",
      nutrition: { calories: 350, proteinG: 14, carbsG: 52, fatG: 8 },
      servings: 1.5,
    };

    expect(computeMealTotals(schedule[0].meals[0])).toEqual({
      calories: 525,
      proteinG: 21,
      carbsG: 78,
      fatG: 12,
    });

    expect(computeDayTotals(schedule[0])).toEqual({
      calories: 1525,
      proteinG: 81,
      carbsG: 178,
      fatG: 42,
    });

    expect(computeWeeklySummary(schedule)).toEqual({
      avgDailyCalories: 1504,
      avgDailyProteinG: 89,
      avgDailyCarbsG: 154,
      avgDailyFatG: 45,
      totalMeals: 21,
    });
  });

  it("serializes 7-day schedules to normalized rows and hydrates out-of-order DB rows", () => {
    const schedule = makeSchedule();
    const rows = serializeWeeklyPlanMeals(42, schedule);
    expect(rows).toHaveLength(21);
    expect(rows[0]).toMatchObject({
      weekly_plan_id: 42,
      day_of_week: 1,
      day_name: "Monday",
      slot_index: 0,
      meal_slot: "Breakfast",
      calories_per_serving: 500,
      servings: 1,
    });

    const shuffledRows = [...rows].reverse().map((row, idx) => ({ ...row, id: idx + 1 }));
    const hydrated = hydrateWeeklyPlanDays(shuffledRows, []);
    expect(hydrated).toHaveLength(7);
    expect(hydrated[0].day).toBe("Monday");
    expect(hydrated[0].meals[0].title).toBe("Meal 1");
    expect(hydrated[6].day).toBe("Sunday");
    expect(hydrated[6].meals[2].title).toBe("Meal 3");
  });

  it("hydrates normalized weekly_plans records and falls back cleanly on legacy 0021 rows", () => {
    const schedule = makeSchedule();
    const normalizedRow = {
      id: 12,
      name: "Cut Week",
      daily_calorie_target: 1800,
      meals_per_day: 3,
      preferred_foods: ["salmon"],
      food_restrictions: ["dairy-free"],
      is_active: true,
      weekly_plan_meals: serializeWeeklyPlanMeals(12, schedule),
      days: [],
      created_at: "2026-11-21T00:00:00Z",
      updated_at: "2026-11-21T01:00:00Z",
    };

    const hydratedNormalized = hydrateWeeklyPlanRecord(normalizedRow);
    expect(hydratedNormalized.isActive).toBe(true);
    expect(hydratedNormalized.preferences).toEqual({
      dailyCalorieTarget: 1800,
      mealsPerDay: 3,
      preferredFoods: ["salmon"],
      foodRestrictions: ["dairy-free"],
    });
    expect(hydratedNormalized.summary?.avgDailyCalories).toBe(1500);

    const legacyRow = {
      id: 9,
      name: "Legacy Week",
      preferences,
      days: schedule,
      created_at: "2026-11-20T00:00:00Z",
      updated_at: "2026-11-20T00:00:00Z",
    };

    const hydratedLegacy = hydrateWeeklyPlanRecord(legacyRow);
    expect(hydratedLegacy.isActive).toBeUndefined();
    expect(hydratedLegacy.summary?.totalMeals).toBe(21);
  });

  it("identifies generic slot labels and preserves ingredients when hydrating DB rows", () => {
    expect(isGenericSlotTitle("Breakfast")).toBe(true);
    expect(isGenericSlotTitle("snack 2")).toBe(true);
    expect(isGenericSlotTitle("Dinner")).toBe(true);
    expect(isGenericSlotTitle("Meal 1")).toBe(true);
    expect(isGenericSlotTitle("Greek Yogurt Parfait")).toBe(false);

    const scheduleWithIngredients: WeeklyPlanDay[] = makeSchedule();
    scheduleWithIngredients[0].meals[0] = {
      ...scheduleWithIngredients[0].meals[0],
      title: "Greek Yogurt Parfait",
      ingredients: ["Greek yogurt", "blueberries", "rolled oats"],
    };

    const rows = serializeWeeklyPlanMeals(15, scheduleWithIngredients);
    const hydrated = hydrateWeeklyPlanDays(rows, scheduleWithIngredients);
    expect(hydrated[0].meals[0].title).toBe("Greek Yogurt Parfait");
    expect(hydrated[0].meals[0].ingredients).toEqual(["Greek yogurt", "blueberries", "rolled oats"]);
  });

  it("validates and hydrates optional grocery_state cleanly while leaving legacy rows unaffected", () => {
    expect(
      weeklyPlanGroceryStateSchema.parse({
        checked: ["spinach"],
        custom: ["Olive oil"],
      }),
    ).toEqual({
      checked: ["spinach"],
      custom: ["Olive oil"],
    });

    const schedule = makeSchedule();
    const withGrocery = hydrateWeeklyPlanRecord({
      id: 21,
      name: "Grocery Plan",
      preferences,
      days: schedule,
      grocery_state: { checked: ["spinach"], custom: ["Sparkling water"] },
      created_at: "2026-11-21T00:00:00Z",
      updated_at: "2026-11-21T00:00:00Z",
    });
    expect(withGrocery.groceryState).toEqual({
      checked: ["spinach"],
      custom: ["Sparkling water"],
    });

    const withoutGrocery = hydrateWeeklyPlanRecord({
      id: 22,
      name: "Legacy Plan",
      preferences,
      days: schedule,
      created_at: "2026-11-21T00:00:00Z",
      updated_at: "2026-11-21T00:00:00Z",
    });
    expect(withoutGrocery.groceryState).toBeUndefined();
  });
});
