import { describe, expect, it } from "vitest";
import { foodLogInputSchema } from "@/lib/food-log-schemas";

describe("food log input boundary", () => {
  const validInput = {
    logDate: "2026-09-07",
    mealType: "lunch",
    foodName: "Rice",
    weightG: 150,
    nutrientRate: { caloriesPerG: 1.3, proteinPerG: 0.02, carbsPerG: 0.28, fatPerG: 0, fiberPerG: 0, sodiumPerG: 0, sugarPerG: 0 },
    source: "database",
    dataSource: "usda",
    aiConfidence: null,
  };

  it("strips any client-supplied computed calorie total", () => {
    const parsed = foodLogInputSchema.parse({ ...validInput, calories: 999999 });
    expect(parsed).not.toHaveProperty("calories");
  });

  it("rejects invalid weight and unknown meal types", () => {
    expect(() => foodLogInputSchema.parse({ ...validInput, weightG: 0 })).toThrow();
    expect(() => foodLogInputSchema.parse({ ...validInput, mealType: "midnight" })).toThrow();
  });
});