import { beforeEach, describe, expect, it, vi } from "vitest";
import { callRecipeAi } from "@/lib/recipes";
import { WEEK_DAYS } from "@/lib/weekly-plan-schemas";
import {
  generateWeeklySchedule,
  regenerateWeeklyDay,
  replaceWeeklyMeal,
} from "./weekly-plans";

vi.mock("@/lib/recipes", () => ({ callRecipeAi: vi.fn() }));

const mockedCallRecipeAi = vi.mocked(callRecipeAi);

const samplePreferences = {
  dailyCalorieTarget: 2000,
  mealsPerDay: 3,
  preferredFoods: ["salmon", "oats"],
  foodRestrictions: ["no peanuts"],
};

describe("weekly plan generator", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects generic slot names in the schema and normalizes valid dishes", async () => {
    mockedCallRecipeAi.mockImplementation(async (prompt, schema) => {
      expect(prompt).toContain("NEVER use generic slot labels");
      expect(prompt).toContain("ingredients");

      const badPayload = {
        title: "Breakfast",
        description: "A quick morning meal.",
        ingredients: ["oats", "milk"],
        nutrition: { calories: 350, proteinG: 14, carbsG: 50, fatG: 9 },
      };
      expect(schema.safeParse(badPayload).success).toBe(false);

      const goodPayload = {
        title: "Smoked Salmon & Avocado Toast",
        description: "Whole-grain sourdough topped with smashed avocado and wild smoked salmon.",
        ingredients: ["sourdough bread", "avocado", "smoked salmon", "lemon"],
        nutrition: { calories: 480, proteinG: 26, carbsG: 38, fatG: 24 },
      };
      return schema.parse(goodPayload);
    });

    const meal = await replaceWeeklyMeal(samplePreferences, "Tuesday", "Breakfast", "Oatmeal");
    expect(meal.title).toBe("Smoked Salmon & Avocado Toast");
    expect(meal.servings).toBe(1);
    expect(meal.ingredients).toEqual(["sourdough bread", "avocado", "smoked salmon", "lemon"]);
  });

  it("regenerates a single day and generates a full 7-day schedule with dish metadata", async () => {
    mockedCallRecipeAi.mockImplementationOnce(async (_prompt, schema) => {
      return schema.parse({
        meals: [
          {
            title: "Berry Oat Smoothie Bowl",
            description: "Blended oats, Greek yogurt, and mixed berries.",
            ingredients: ["rolled oats", "Greek yogurt", "mixed berries"],
            nutrition: { calories: 420, proteinG: 24, carbsG: 55, fatG: 10 },
          },
          {
            title: "Herb Chicken & Quinoa Salad",
            description: "Grilled chicken breast with fluffy quinoa and lemon vinaigrette.",
            ingredients: ["chicken breast", "quinoa", "mixed greens"],
            nutrition: { calories: 650, proteinG: 48, carbsG: 52, fatG: 22 },
          },
          {
            title: "Roasted Cod with Asparagus",
            description: "Oven-roasted cod fillets with garlic asparagus and brown rice.",
            ingredients: ["cod fillets", "asparagus", "brown rice"],
            nutrition: { calories: 620, proteinG: 44, carbsG: 58, fatG: 18 },
          },
        ],
      });
    });

    const dayPlan = await regenerateWeeklyDay(samplePreferences, "Wednesday");
    expect(dayPlan.day).toBe("Wednesday");
    expect(dayPlan.meals).toHaveLength(3);
    expect(dayPlan.meals[0].servings).toBe(1);

    mockedCallRecipeAi.mockImplementationOnce(async (prompt, schema, options) => {
      expect(options?.maxOutputTokens).toBe(8000);
      expect(prompt).toContain("avoid repeating these dishes already used in other saved plans");
      expect(prompt).toContain("Spicy Tuna Bowl");
      return schema.parse({
        days: WEEK_DAYS.map((day) => ({
          day,
          meals: [
            {
              title: `${day} Cinnamon Apple Oats`,
              description: "Warm rolled oats simmered with diced apple and cinnamon.",
              ingredients: ["rolled oats", "apple", "cinnamon"],
              nutrition: { calories: 410, proteinG: 18, carbsG: 62, fatG: 9 },
            },
            {
              title: `${day} Lemon Chicken Wrap`,
              description: "Whole-wheat wrap filled with grilled chicken and crisp romaine.",
              ingredients: ["chicken breast", "wheat wrap", "romaine"],
              nutrition: { calories: 610, proteinG: 45, carbsG: 50, fatG: 20 },
            },
            {
              title: `${day} Glazed Salmon Plate`,
              description: "Baked salmon served with steamed broccoli and jasmine rice.",
              ingredients: ["salmon", "broccoli", "jasmine rice"],
              nutrition: { calories: 680, proteinG: 42, carbsG: 60, fatG: 24 },
            },
          ],
        })),
      });
    });

    const schedule = await generateWeeklySchedule(samplePreferences, ["Spicy Tuna Bowl", "Spicy Tuna Bowl"]);
    expect(schedule).toHaveLength(7);
    expect(schedule[0].meals[0].title).toBe("Monday Cinnamon Apple Oats");
  });
});
