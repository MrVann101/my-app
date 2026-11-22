import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { claimGlobalAiRateLimit, claimRateLimit } from "@/lib/rate-limit";
import { generateRecipe, generateRecipeRequestSchema } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const body = await parseJson(request, generateRecipeRequestSchema);

    await claimRateLimit({
      key: `ai_generate_recipe:${user.id}`,
      windowSeconds: 3600,
      limit: 20,
      message: "You have generated several recipes this hour. Please try again shortly.",
    });

    const globallyAllowed = await claimGlobalAiRateLimit(60, supabase);
    if (!globallyAllowed) {
      throw new ApiError(429, "Recipe generation is busy right now. Try again shortly.", "global_ai_rate_limit");
    }

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
