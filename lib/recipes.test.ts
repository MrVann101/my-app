import { describe, expect, it } from "vitest";
import { buildPlanRecipe, validatePlanRecipe } from "./recipes";

describe("plan recipes", () => {
  it("builds a bounded recipe from plan items only", () => {
    const recipe = buildPlanRecipe("Lunch", [{ food_name: "Rice", weight_g: 150 }, { food_name: "Egg", weight_g: 50 }]);
    expect(recipe.ingredients.map((item) => item.name)).toEqual(["Rice", "Egg"]);
    expect(recipe.steps.length).toBeGreaterThan(0);
  });

  it("rejects ingredients outside the plan", () => {
    expect(() => validatePlanRecipe({ title: "Test", cookTimeMinutes: 20, ingredients: [{ name: "Salt", amount: "1g" }], steps: ["Mix."] }, ["Rice"])).toThrow("outside the meal plan");
  });
});
