import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { suggestRecipes, suggestionsRequestSchema } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = await parseJson(request, suggestionsRequestSchema);
    try {
      return Response.json(await suggestRecipes(body.ingredients));
    } catch (error) {
      console.error("meal_recipe_suggestions_failed", error instanceof Error ? error.message : "Unknown AI provider error");
      throw new ApiError(502, "Meal suggestions are temporarily unavailable. Please try again.", "recipe_suggestions_failed");
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
