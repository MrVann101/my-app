import { z } from "zod";

export const recipeNutritionSchema = z.object({
  calories: z.number().finite().nonnegative().max(5000),
  proteinG: z.number().finite().nonnegative().max(500),
  carbsG: z.number().finite().nonnegative().max(1000),
  fatG: z.number().finite().nonnegative().max(500),
});
