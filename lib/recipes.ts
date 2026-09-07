import { z } from "zod";

export const recipeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  cookTimeMinutes: z.number().int().min(1).max(240),
  ingredients: z.array(z.object({ name: z.string().trim().min(1).max(200), amount: z.string().trim().min(1).max(80) })).min(1).max(20),
  steps: z.array(z.string().trim().min(1).max(400)).min(1).max(12),
});
export type Recipe = z.infer<typeof recipeSchema>;

export function buildPlanRecipe(planName: string, items: Array<{ food_name: string; weight_g: number }>): Recipe {
  const ingredients = items.map((item) => ({ name: item.food_name, amount: `${Math.round(Number(item.weight_g))}g` }));
  const names = items.map((item) => item.food_name).join(", ");
  return recipeSchema.parse({ title: `${planName} bowl`, cookTimeMinutes: Math.min(45, Math.max(10, items.length * 8)), ingredients, steps: [`Gather ${names}.`, "Prepare each ingredient using a suitable cooking method.", "Combine the prepared ingredients and serve." ] });
}

export function validatePlanRecipe(recipe: unknown, allowedNames: string[]): Recipe {
  const parsed = recipeSchema.parse(recipe);
  const allowed = new Set(allowedNames.map((name) => name.trim().toLowerCase()));
  if (parsed.ingredients.some((ingredient) => !allowed.has(ingredient.name.toLowerCase()))) throw new Error("Recipe contains an ingredient outside the meal plan.");
  return parsed;
}
