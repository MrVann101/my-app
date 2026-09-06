import { describe, expect, it } from "vitest";
import { computeNutrients, getWeightWarning, nutrientRateSchema } from "@/lib/food";

describe("food nutrient scaling", () => {
  const rate = {
    caloriesPerG: 1.5,
    proteinPerG: 0.1,
    carbsPerG: 0.2,
    fatPerG: 0.05,
    fiberPerG: 0.03,
    sodiumPerG: 0.004,
    sugarPerG: 0.02,
  };

  it("computes every nutrient from weight and per-gram rates", () => {
    expect(computeNutrients(200, rate)).toEqual({
      calories: 300,
      proteinG: 20,
      carbsG: 40,
      fatG: 10,
      fiberG: 6,
      sodiumMg: 0.8,
      sugarG: 4,
    });
  });

  it("scales proportionally when weight changes", () => {
    const half = computeNutrients(100, rate);
    const full = computeNutrients(200, rate);
    expect(full.calories).toBe(half.calories * 2);
    expect(full.proteinG).toBe(half.proteinG * 2);
    expect(full.sodiumMg).toBe(half.sodiumMg * 2);
  });

  it("rejects negative rates and impossible weights", () => {
    expect(() => nutrientRateSchema.parse({ ...rate, fatPerG: -1 })).toThrow();
    expect(() => computeNutrients(0, rate)).toThrow();
    expect(() => computeNutrients(100_001, rate)).toThrow();
  });

  it("returns soft warnings for implausible portion sizes", () => {
    expect(getWeightWarning(5)).toMatch(/small portion/);
    expect(getWeightWarning(2_001)).toMatch(/large portion/);
    expect(getWeightWarning(150)).toBeNull();
  });
});
