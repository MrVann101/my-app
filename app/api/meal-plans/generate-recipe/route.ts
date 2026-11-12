import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { generateRecipe, generateRecipeRequestSchema } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = await parseJson(request, generateRecipeRequestSchema);
    try {
      return Response.json(await generateRecipe(body.ingredients, body.suggestion));
    } catch (error) {
      console.error("meal_recipe_generation_failed", error instanceof Error ? error.message : "Unknown AI provider error");
      throw new ApiError(502, "Recipe generation is temporarily unavailable. Please try again.", "recipe_generation_failed");
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
