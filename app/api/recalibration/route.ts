import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { calculateRecalibration, hasEnoughWeightCheckins, MIN_RECALIBRATION_CHECKINS, shouldShowRecommendation } from "@/lib/recalibration";
import { createClient } from "@/lib/supabase/server";

const WINDOW_DAYS = 28;
const actionSchema = z.object({ action: z.enum(["accepted", "dismissed"]), recommendedCalories: z.number().finite().positive() });

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getUser();
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [{ data: profile, error: profileError }, { data: logs, error: logsError }, { data: state, error: stateError }] = await Promise.all([
      supabase.from("profiles").select("target_calories, tdee, sex, goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("weight_logs").select("log_date, weight_kg").eq("user_id", user.id).gte("log_date", since).order("log_date", { ascending: true }),
      supabase.from("recalibration_states").select("state, recommended_calories, updated_at").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileError || logsError || stateError) throw new ApiError(400, "Unable to load recalibration data.", "recalibration_fetch_failed");
    if (!profile?.target_calories || !profile.tdee || !hasEnoughWeightCheckins(logs?.length ?? 0)) return Response.json({ eligible: false, checkins: logs?.length ?? 0, requiredCheckins: MIN_RECALIBRATION_CHECKINS, windowDays: WINDOW_DAYS, state });
    const first = logs![0];
    const last = logs![logs!.length - 1];
    const result = calculateRecalibration({ firstWeightKg: Number(first.weight_kg), lastWeightKg: Number(last.weight_kg), days: Math.max(1, Math.round((new Date(`${last.log_date}T00:00:00Z`).getTime() - new Date(`${first.log_date}T00:00:00Z`).getTime()) / 86_400_000)), targetCalories: Number(profile.target_calories), tdee: Number(profile.tdee), safetyFloor: profile.sex === "male" ? 1500 : 1200 });
    return Response.json({ eligible: shouldShowRecommendation(result.direction, state ? Number(state.recommended_calories) : null, result.recommendedCalories), checkins: logs!.length, windowDays: WINDOW_DAYS, state, recommendation: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getUser();
    const body = await parseJson(request, actionSchema);
    const { error } = await supabase.from("recalibration_states").upsert({ user_id: user.id, state: body.action, recommended_calories: body.recommendedCalories, updated_at: new Date().toISOString() });
    if (error) throw new ApiError(400, error.message, "recalibration_state_failed");
    return Response.json({ state: body.action });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
