import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { computeNutrients, foodWeightSchema } from "@/lib/food";
import { createClient } from "@/lib/supabase/server";
import { updateStreak } from "@/lib/streaks";

const updateSchema = z.object({ weightG: foodWeightSchema }).strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { supabase, user } = await authenticatedClient();
    const { id } = await context.params;
    const logId = parseId(id);
    const body = updateSchema.parse(await request.json());
    const { data: existing, error: existingError } = await supabase.from("food_logs").select("id, log_date").eq("id", logId).eq("user_id", user.id).maybeSingle();
    if (existingError) throw new ApiError(400, existingError.message, "food_log_fetch_failed");
    if (!existing) throw new ApiError(404, "Food log not found.", "food_log_not_found");

    const { data: source, error: sourceError } = await supabase.from("food_logs").select("calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g").eq("id", logId).eq("user_id", user.id).single();
    if (sourceError) throw new ApiError(400, sourceError.message, "food_log_fetch_failed");
    const computed = computeNutrients(body.weightG, {
      caloriesPerG: Number(source.calories_per_g),
      proteinPerG: Number(source.protein_per_g),
      carbsPerG: Number(source.carbs_per_g),
      fatPerG: Number(source.fat_per_g),
      fiberPerG: Number(source.fiber_per_g),
      sodiumPerG: Number(source.sodium_per_g),
      sugarPerG: Number(source.sugar_per_g),
    });
    const { data: log, error } = await supabase.from("food_logs").update({
      weight_g: body.weightG,
      calories: computed.calories,
      protein_g: computed.proteinG,
      carbs_g: computed.carbsG,
      fat_g: computed.fatG,
      fiber_g: computed.fiberG,
      sodium_mg: computed.sodiumMg,
      sugar_g: computed.sugarG,
    }).eq("id", logId).eq("user_id", user.id).select().single();
    if (error) throw new ApiError(400, error.message, "food_log_update_failed");
    await refreshSummaryAndStreak(supabase, existing.log_date);
    return Response.json({ log });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { supabase, user } = await authenticatedClient();
    const { id } = await context.params;
    const logId = parseId(id);
    const { data: existing, error: existingError } = await supabase.from("food_logs").select("id, log_date").eq("id", logId).eq("user_id", user.id).maybeSingle();
    if (existingError) throw new ApiError(400, existingError.message, "food_log_fetch_failed");
    if (!existing) throw new ApiError(404, "Food log not found.", "food_log_not_found");

    const { error } = await supabase.from("food_logs").delete().eq("id", logId).eq("user_id", user.id);
    if (error) throw new ApiError(400, error.message, "food_log_delete_failed");
    await refreshSummaryAndStreak(supabase, existing.log_date);
    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
  return { supabase, user };
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Food log id is invalid.", "invalid_id");
  return id;
}

async function refreshSummaryAndStreak(supabase: Awaited<ReturnType<typeof createClient>>, logDate: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
  const [{ data: logs, error: logsError }, { data: exercises, error: exerciseError }, { data: profile }] = await Promise.all([
    supabase.from("food_logs").select("calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g").eq("user_id", user.id).eq("log_date", logDate),
    supabase.from("exercise_logs").select("calories_burned").eq("user_id", user.id).eq("log_date", logDate),
    supabase.from("profiles").select("target_calories").eq("user_id", user.id).maybeSingle(),
  ]);
  if (logsError || exerciseError) throw new ApiError(400, "Unable to refresh daily totals.", "summary_refresh_failed");
  const total = (key: "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sodium_mg" | "sugar_g") => (logs ?? []).reduce((sum, log) => sum + Number(log[key] ?? 0), 0);
  const caloriesBurned = (exercises ?? []).reduce((sum, exercise) => sum + Number(exercise.calories_burned ?? 0), 0);
  const totalCalories = total("calories");
  const targetCalories = Number(profile?.target_calories ?? 0);
  const { error: summaryError } = await supabase.from("daily_summaries").upsert({ user_id: user.id, summary_date: logDate, total_calories: totalCalories, total_protein_g: total("protein_g"), total_carbs_g: total("carbs_g"), total_fat_g: total("fat_g"), total_fiber_g: total("fiber_g"), total_sodium_mg: total("sodium_mg"), total_sugar_g: total("sugar_g"), calories_burned: caloriesBurned, hit_target: targetCalories > 0 && Math.abs(totalCalories - targetCalories) <= targetCalories * 0.1, logged_at_least_once: (logs ?? []).length > 0 }, { onConflict: "user_id,summary_date" });
  if (summaryError) throw new ApiError(400, summaryError.message, "summary_save_failed");
  await rebuildStreak(supabase, user.id);
}

async function rebuildStreak(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: summaries, error } = await supabase.from("daily_summaries").select("summary_date, logged_at_least_once").eq("user_id", userId).eq("logged_at_least_once", true).order("summary_date", { ascending: true });
  if (error) throw new ApiError(400, error.message, "streak_fetch_failed");
  let state = { currentStreak: 0, longestStreak: 0, lastLogDate: null as string | null };
  for (const summary of summaries ?? []) state = updateStreak(state, summary.summary_date);
  const { error: saveError } = await supabase.from("streaks").upsert({ user_id: userId, current_streak: state.currentStreak, longest_streak: state.longestStreak, last_log_date: state.lastLogDate });
  if (saveError) throw new ApiError(400, saveError.message, "streak_save_failed");
}
