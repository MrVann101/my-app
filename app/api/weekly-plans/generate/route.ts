import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { claimGlobalAiRateLimit, claimRateLimit } from "@/lib/rate-limit";
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

    await claimRateLimit({
      key: `ai_weekly_plan:${user.id}`,
      windowSeconds: 3600,
      limit: 15,
      message: "You have generated several weekly plans this hour. Please try again shortly.",
    });

    const globallyAllowed = await claimGlobalAiRateLimit(60, supabase);
    if (!globallyAllowed) {
      throw new ApiError(429, "Weekly plan generation is busy right now. Try again shortly.", "global_ai_rate_limit");
    }

    try {
      if (body.action === "week") {
        return Response.json({ days: await generateWeeklySchedule(body.preferences, body.excludeTitles) });
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
