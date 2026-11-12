import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { estimateMealNutrition, mealNutritionRequestSchema } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = await parseJson(request, mealNutritionRequestSchema);

    const bucketStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const { data: globallyAllowed, error: limitError } = await supabase.rpc("claim_global_ai_rate_limit", {
      p_bucket_start: bucketStart,
      p_limit: 60,
    });
    if (limitError) throw new ApiError(503, "Meal calorie estimation is not configured yet. Apply the global AI limit migration first.", "ai_rate_limit_unavailable");
    if (!globallyAllowed) throw new ApiError(429, "Meal calorie estimation is busy right now. Try again shortly.", "global_ai_rate_limit");

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
