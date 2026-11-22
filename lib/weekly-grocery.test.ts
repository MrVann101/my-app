import { describe, expect, it } from "vitest";
import { WEEK_DAYS, type WeeklyPlanDay } from "./weekly-plan-schemas";
import {
  buildWeeklyGroceryList,
  countWeeklyGroceryItems,
  formatGroceryListText,
  mergeWeeklyGroceryItems,
} from "./weekly-grocery";

function emptyWeek(): WeeklyPlanDay[] {
  return WEEK_DAYS.map((day) => ({
    day,
    meals: [
      {
        title: "Breakfast",
        description: "A balanced meal.",
        nutrition: { calories: 400, proteinG: 20, carbsG: 50, fatG: 10 },
        servings: 1,
      },
      {
        title: "Snack 1",
        description: "A balanced meal.",
        nutrition: { calories: 200, proteinG: 10, carbsG: 20, fatG: 8 },
        servings: 1,
      },
    ],
  }));
}

describe("weekly grocery list builder", () => {
  it("deduplicates structured ingredients across days and categorizes cleanly", () => {
    const days = emptyWeek();
    days[0].meals[0] = {
      title: "Greek Yogurt Parfait",
      description: "Creamy yogurt layered with berries and crunchy oats.",
      ingredients: ["Greek yogurt", "Blueberries", "Rolled oats"],
      nutrition: { calories: 380, proteinG: 22, carbsG: 48, fatG: 9 },
      servings: 1,
    };
    days[2].meals[0] = {
      title: "Berry Oat Bowl",
      description: "Warm oatmeal topped with blueberries and grilled chicken side.",
      ingredients: ["blueberries", "rolled oats", "Chicken breast"],
      nutrition: { calories: 450, proteinG: 35, carbsG: 52, fatG: 8 },
      servings: 1,
    };

    const items = buildWeeklyGroceryList(days);
    const blueberries = items.find((item) => item.key === "blueberries");
    const chicken = items.find((item) => item.key === "chicken breast");
    const yogurt = items.find((item) => item.key === "greek yogurt");

    expect(blueberries).toEqual({
      key: "blueberries",
      name: "Blueberries",
      count: 2,
      days: ["Mon", "Wed"],
      category: "Produce",
    });
    expect(chicken?.category).toBe("Protein");
    expect(yogurt?.category).toBe("Dairy & Eggs");
  });

  it("extracts fallback items from named dishes while skipping generic slot titles", () => {
    const days = emptyWeek();
    days[1].meals[0] = {
      title: "Grilled Salmon with Quinoa & Spinach",
      description: "Pan-seared salmon served over fluffy quinoa and spinach.",
      nutrition: { calories: 580, proteinG: 42, carbsG: 40, fatG: 24 },
      servings: 1,
    };

    const items = buildWeeklyGroceryList(days);
    expect(items.some((item) => item.key === "breakfast" || item.key === "snack 1")).toBe(false);
    expect(items.map((item) => item.name)).toEqual(["Spinach", "Salmon", "Quinoa"]);
  });

  it("caps legacy fallback items and skips long sentence-like descriptions", () => {
    const days = emptyWeek();
    days[0].meals[0] = {
      title: "Breakfast",
      description:
        "A freshly prepared morning plate served slowly beside hot coffee for sustained energy throughout your busy day, eggs, topped with a drizzle of olive oil, a side of spinach",
      nutrition: { calories: 420, proteinG: 20, carbsG: 30, fatG: 22 },
      servings: 1,
    };

    const items = buildWeeklyGroceryList(days);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.every((item) => item.name.length <= 32)).toBe(true);
    expect(items.some((item) => item.key === "eggs")).toBe(true);
    expect(items.some((item) => item.key === "spinach")).toBe(true);
  });

  it("formats unchecked items clearly for clipboard sharing", () => {
    const items = [
      { key: "spinach", name: "Spinach", count: 2, days: ["Mon", "Thu"], category: "Produce" as const },
      { key: "chicken breast", name: "Chicken breast", count: 1, days: ["Tue"], category: "Protein" as const },
    ];
    const formatted = formatGroceryListText("Cut Plan", items, new Set(["spinach"]));
    expect(formatted).toContain("Cut Plan — Grocery List");
    expect(formatted).not.toContain("Spinach");
    expect(formatted).toContain("[ ] Chicken breast (Tue)");
  });

  it("merges and counts distinct grocery items per weekly schedule without duplicating generated or custom items", () => {
    const planA = emptyWeek();
    planA[0].meals[0] = {
      title: "Salmon Spinach Bowl",
      description: "Salmon with spinach.",
      ingredients: ["Salmon", "Spinach"],
      nutrition: { calories: 500, proteinG: 40, carbsG: 10, fatG: 28 },
      servings: 1,
    };

    const planB = emptyWeek();
    planB[0].meals[0] = {
      title: "Oat Banana Shake",
      description: "Rolled oats with banana and milk.",
      ingredients: ["Rolled oats", "Banana", "Milk"],
      nutrition: { calories: 420, proteinG: 18, carbsG: 65, fatG: 9 },
      servings: 1,
    };

    const generatedA = buildWeeklyGroceryList(planA);
    const mergedA = mergeWeeklyGroceryItems(generatedA, ["spinach", "Olive oil", "olive oil"]);

    expect(mergedA.map((item) => item.name)).toEqual(["Spinach", "Salmon", "Olive oil"]);
    expect(mergedA.find((item) => item.name === "Olive oil")?.isCustom).toBe(true);
    expect(countWeeklyGroceryItems(planA, ["Olive oil"])).toBe(3);

    const generatedB = buildWeeklyGroceryList(planB);
    expect(generatedB.map((item) => item.name)).toEqual(["Banana", "Milk", "Rolled oats"]);
    expect(countWeeklyGroceryItems(planB, [])).toBe(3);
  });

  it("normalizes Unicode hyphens and splits legacy descriptions across over/on/served-with clauses", () => {
    const legacyPlan = emptyWeek();
    legacyPlan[0].meals[1] = {
      title: "Lunch",
      description: "Grilled chicken breast over mixed greens with vinaigrette.",
      nutrition: { calories: 520, proteinG: 42, carbsG: 14, fatG: 30 },
      servings: 1,
    };

    const legacyItems = buildWeeklyGroceryList(legacyPlan);
    expect(legacyItems.map((item) => item.name)).toEqual(["Greens", "Chicken breast", "Vinaigrette"]);

    const modernPlan = emptyWeek();
    modernPlan[0].meals[0] = {
      title: "Turkey Avocado Wrap",
      description: "Turkey wrapped in a whole\u2011grain tortilla.",
      ingredients: ["whole\u2011grain tortilla", "sliced turkey breast", "avocado"],
      nutrition: { calories: 480, proteinG: 30, carbsG: 42, fatG: 18 },
      servings: 1,
    };
    modernPlan[1].meals[0] = {
      title: "Veggie Hummus Wrap",
      description: "Crisp veggies in a whole-grain tortilla.",
      ingredients: ["whole-grain tortilla", "hummus"],
      nutrition: { calories: 410, proteinG: 14, carbsG: 48, fatG: 16 },
      servings: 1,
    };

    const modernItems = buildWeeklyGroceryList(modernPlan);
    const tortilla = modernItems.find((item) => item.key === "whole-grain tortilla");
    expect(tortilla).toEqual({
      key: "whole-grain tortilla",
      name: "Whole-grain tortilla",
      count: 2,
      days: ["Mon", "Tue"],
      category: "Grains & Pantry",
    });
    expect(modernItems.length).toBe(4);
    expect(legacyItems.length).toBe(3);
    expect(modernItems.map((item) => item.key)).not.toEqual(legacyItems.map((item) => item.key));
  });
});
