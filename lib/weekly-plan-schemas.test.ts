import { describe, expect, it } from "vitest";
import {
  WEEK_DAYS,
  getMealSlotLabel,
  weeklyPlanPreferencesSchema,
  weeklyPlanScheduleSchema,
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
});
