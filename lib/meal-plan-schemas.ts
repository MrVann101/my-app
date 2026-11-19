import { z } from "zod";
import { foodWeightSchema, nutrientRateSchema } from "@/lib/food";
import { generatedRecipeSchema } from "@/lib/recipes";

const itemSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  foodName: z.string().trim().min(1).max(200),
  weightG: foodWeightSchema,
  nutrientRate: nutrientRateSchema,
});

export const mealPlanInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visibility: z.enum(["private", "public"]).default("private"),
  goal: z.enum(["lose", "maintain", "gain"]).nullable().default(null),
  dietType: z.string().trim().max(80).nullable().default(null),
  items: z.array(itemSchema).min(1).max(50).optional(),
  recipe: generatedRecipeSchema.optional(),
}).refine((body) => body.recipe || (body.name && body.items?.length), {
  message: "Provide a generated recipe or a named plan with food items.",
});

export type MealPlanInput = z.infer<typeof mealPlanInputSchema>;
