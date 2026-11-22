import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { claimGlobalAiRateLimit, claimRateLimit } from "@/lib/rate-limit";
import { estimateMealNutrition, mealNutritionRequestSchema } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const body = await parseJson(request, mealNutritionRequestSchema);

    await claimRateLimit({
      key: `ai_estimate_nutrition:${user.id}`,
      windowSeconds: 3600,
      limit: 30,
      message: "You have run several nutrition estimates this hour. Please try again shortly.",
    });

    const globallyAllowed = await claimGlobalAiRateLimit(60, supabase);
    if (!globallyAllowed) {
      throw new ApiError(429, "Meal calorie estimation is busy right now. Try again shortly.", "global_ai_rate_limit");
    }

    try {
      return Response.json(await estimateMealNutrition(body.name, body.ingredients));
    } catch (error) {
      console.error("meal_nutrition_estimation_failed", error instanceof Error ? error.message : "Unknown AI provider error");
      throw new ApiError(502, "Meal calorie estimation is temporarily unavailable. Please try posting again.", "meal_nutrition_estimation_failed");
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
