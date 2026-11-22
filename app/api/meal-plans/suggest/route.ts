import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { claimGlobalAiRateLimit, claimRateLimit } from "@/lib/rate-limit";
import { suggestRecipes, suggestionsRequestSchema } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const body = await parseJson(request, suggestionsRequestSchema);

    await claimRateLimit({
      key: `ai_meal_suggest:${user.id}`,
      windowSeconds: 3600,
      limit: 20,
      message: "You have generated several meal suggestions this hour. Please try again shortly.",
    });

    const globallyAllowed = await claimGlobalAiRateLimit(60, supabase);
    if (!globallyAllowed) {
      throw new ApiError(429, "Meal suggestions are busy right now. Try again shortly.", "global_ai_rate_limit");
    }

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
