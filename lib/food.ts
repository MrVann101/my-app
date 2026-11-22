import { z } from "zod";
import type { AiTextEstimate, ComputedNutrients, NutrientRate } from "@/lib/types";

export const nutrientRateSchema = z.object({
  caloriesPerG: z.number().finite().nonnegative().max(10),
  proteinPerG: z.number().finite().nonnegative().max(1.2),
  carbsPerG: z.number().finite().nonnegative().max(1.2),
  fatPerG: z.number().finite().nonnegative().max(1.2),
  fiberPerG: z.number().finite().nonnegative().max(1.2),
  sodiumPerG: z.number().finite().nonnegative().max(1_000),
  sugarPerG: z.number().finite().nonnegative().max(1.2),
});

export const foodWeightSchema = z.number().finite().positive().max(100_000);

export function getWeightWarning(weightG: number): string | null {
  if (weightG < 10) return "That is a very small portion. Check the weight if this was not a bite-sized amount.";
  if (weightG > 2_000) return "That is a large portion. Check the weight if this was not a shared or bulk amount.";
  return null;
}

export function displayNutrient(value: number, source: "usda" | "off" | "gemini" | "groq" | "manual" | null, unit: string): string {
  if (value === 0 && source !== "usda" && source !== "off") return "Not reported";
  return `${round(value)}${unit}`;
}

export function computeNutrients(weightG: number, nutrientRate: NutrientRate): ComputedNutrients {
  const weight = foodWeightSchema.parse(weightG);
  const rate = nutrientRateSchema.parse(nutrientRate);

  return {
    calories: round(rate.caloriesPerG * weight),
    proteinG: round(rate.proteinPerG * weight),
    carbsG: round(rate.carbsPerG * weight),
    fatG: round(rate.fatPerG * weight),
    fiberG: round(rate.fiberPerG * weight),
    sodiumMg: round(rate.sodiumPerG * weight),
    sugarG: round(rate.sugarPerG * weight),
  };
}

export function combineFoodEstimates(estimates: AiTextEstimate[]): AiTextEstimate | null {
  if (estimates.length === 0) return null;

  const totalWeightG = estimates.reduce((total, item) => total + item.estimatedWeightG, 0);
  const weightG = Math.min(totalWeightG, 100_000);
  const totals = estimates.reduce<ComputedNutrients>((combined, item) => {
    const nutrients = computeNutrients(item.estimatedWeightG, item.nutrientRate);
    return {
      calories: combined.calories + nutrients.calories,
      proteinG: combined.proteinG + nutrients.proteinG,
      carbsG: combined.carbsG + nutrients.carbsG,
      fatG: combined.fatG + nutrients.fatG,
      fiberG: combined.fiberG + nutrients.fiberG,
      sodiumMg: combined.sodiumMg + nutrients.sodiumMg,
      sugarG: combined.sugarG + nutrients.sugarG,
    };
  }, { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, sugarG: 0 });

  return {
    foodName: estimates.map((item) => item.foodName.trim()).filter(Boolean).join(", ").slice(0, 200) || "Meal",
    estimatedWeightG: weightG,
    nutrientRate: {
      caloriesPerG: totals.calories / weightG,
      proteinPerG: totals.proteinG / weightG,
      carbsPerG: totals.carbsG / weightG,
      fatPerG: totals.fatG / weightG,
      fiberPerG: totals.fiberG / weightG,
      sodiumPerG: totals.sodiumMg / weightG,
      sugarPerG: totals.sugarG / weightG,
    },
    confidence: estimates.some((item) => item.confidence === "low")
      ? "low"
      : estimates.every((item) => item.confidence === "high") ? "high" : "medium",
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
