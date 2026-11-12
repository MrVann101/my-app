import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import {
  generateWeeklySchedule,
  regenerateWeeklyDay,
  replaceWeeklyMeal,
} from "@/lib/weekly-plans";
import { weeklyPlanGenerationRequestSchema } from "@/lib/weekly-plan-schemas";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = await parseJson(request, weeklyPlanGenerationRequestSchema);

    const bucketStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const { data: globallyAllowed, error: limitError } = await supabase.rpc("claim_global_ai_rate_limit", {
      p_bucket_start: bucketStart,
      p_limit: 60,
    });
    if (limitError) {
      throw new ApiError(503, "Weekly plan generation is not configured yet. Apply the global AI limit migration first.", "ai_rate_limit_unavailable");
    }
    if (!globallyAllowed) {
      throw new ApiError(429, "Weekly plan generation is busy right now. Try again shortly.", "global_ai_rate_limit");
    }

    try {
      if (body.action === "week") {
        return Response.json({ days: await generateWeeklySchedule(body.preferences) });
      }
      if (body.action === "day") {
        return Response.json({ day: await regenerateWeeklyDay(body.preferences, body.day) });
      }
      return Response.json({
        meal: await replaceWeeklyMeal(body.preferences, body.day, body.slot, body.currentTitle),
      });
    } catch (error) {
      console.error("weekly_plan_generation_failed", error instanceof Error ? error.message : "Unknown AI provider error");
      throw new ApiError(502, "AI meal planning is temporarily unavailable. Please try again.", "weekly_plan_generation_failed");
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
