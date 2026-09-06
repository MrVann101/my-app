import { z } from "zod";
import type { ComputedNutrients, NutrientRate } from "@/lib/types";

export const nutrientRateSchema = z.object({
  caloriesPerG: z.number().finite().nonnegative(),
  proteinPerG: z.number().finite().nonnegative(),
  carbsPerG: z.number().finite().nonnegative(),
  fatPerG: z.number().finite().nonnegative(),
  fiberPerG: z.number().finite().nonnegative(),
  sodiumPerG: z.number().finite().nonnegative(),
  sugarPerG: z.number().finite().nonnegative(),
});

export const foodWeightSchema = z.number().finite().positive().max(100_000);

export function getWeightWarning(weightG: number): string | null {
  if (weightG < 10) return "That is a very small portion. Check the weight if this was not a bite-sized amount.";
  if (weightG > 2_000) return "That is a large portion. Check the weight if this was not a shared or bulk amount.";
  return null;
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

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
