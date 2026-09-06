import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { computeNutrients, foodWeightSchema, nutrientRateSchema } from "@/lib/food";
import { createClient } from "@/lib/supabase/server";
import { updateStreak } from "@/lib/streaks";

export const foodLogInputSchema = z.object({
  logDate: z.iso.date(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  foodName: z.string().trim().min(1).max(200),
  weightG: foodWeightSchema,
  nutrientRate: nutrientRateSchema,
  source: z.enum(["ai_photo", "ai_text", "database", "manual"]),
  dataSource: z.enum(["usda", "off", "gemini", "groq"]).nullable().default(null),
  aiConfidence: z.enum(["low", "medium", "high"]).nullable().default(null),
  photoUrl: z.string().url().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const body = await parseJson(request, foodLogInputSchema);
    const computed = computeNutrients(body.weightG, body.nutrientRate);
    const { data: log, error } = await supabase.from("food_logs").insert({
      user_id: user.id,
      log_date: body.logDate,
      meal_type: body.mealType,
      food_name: body.foodName,
      weight_g: body.weightG,
      calories_per_g: body.nutrientRate.caloriesPerG,
      protein_per_g: body.nutrientRate.proteinPerG,
      carbs_per_g: body.nutrientRate.carbsPerG,
      fat_per_g: body.nutrientRate.fatPerG,
      fiber_per_g: body.nutrientRate.fiberPerG,
      sodium_per_g: body.nutrientRate.sodiumPerG,
      sugar_per_g: body.nutrientRate.sugarPerG,
      calories: computed.calories,
      protein_g: computed.proteinG,
      carbs_g: computed.carbsG,
      fat_g: computed.fatG,
      fiber_g: computed.fiberG,
      sodium_mg: computed.sodiumMg,
      sugar_g: computed.sugarG,
      source: body.source,
      data_source: body.dataSource,
      ai_confidence: body.aiConfidence,
      photo_url: body.photoUrl ?? null,
    }).select().single();

    if (error) throw new ApiError(400, error.message, "food_log_save_failed");
    const timezone = await refreshDailySummary(supabase, user.id, body.logDate);
    if (body.logDate === localDate(timezone)) await refreshStreak(supabase, user.id, body.logDate);
    return Response.json({ log }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const params = new URL(request.url).searchParams;
    const date = params.get("date");
    const from = params.get("from");
    const to = params.get("to");
    const query = supabase.from("food_logs").select("*").eq("user_id", user.id).order("log_date", { ascending: false }).order("created_at", { ascending: false });
    const filtered = date ? query.eq("log_date", date) : query.gte("log_date", from ?? "1900-01-01").lte("log_date", to ?? "2999-12-31");
    const { data: logs, error } = await filtered;
    if (error) throw new ApiError(400, error.message, "food_log_fetch_failed");
    return Response.json({ logs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function refreshDailySummary(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, logDate: string): Promise<string> {
  const [{ data: logs, error: logsError }, { data: exercises, error: exerciseError }, { data: profile }] = await Promise.all([
    supabase.from("food_logs").select("calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g").eq("user_id", userId).eq("log_date", logDate),
    supabase.from("exercise_logs").select("calories_burned").eq("user_id", userId).eq("log_date", logDate),
    supabase.from("profiles").select("target_calories, timezone").eq("user_id", userId).maybeSingle(),
  ]);
  if (logsError || exerciseError) throw new ApiError(400, "Unable to refresh daily totals.", "summary_refresh_failed");

  const total = (key: "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sodium_mg" | "sugar_g") => (logs ?? []).reduce((sum, log) => sum + Number(log[key] ?? 0), 0);
  const caloriesBurned = (exercises ?? []).reduce((sum, exercise) => sum + Number(exercise.calories_burned ?? 0), 0);
  const totalCalories = total("calories");
  const targetCalories = Number(profile?.target_calories ?? 0);
  const { error } = await supabase.from("daily_summaries").upsert({
    user_id: userId,
    summary_date: logDate,
    total_calories: totalCalories,
    total_protein_g: total("protein_g"),
    total_carbs_g: total("carbs_g"),
    total_fat_g: total("fat_g"),
    total_fiber_g: total("fiber_g"),
    total_sodium_mg: total("sodium_mg"),
    total_sugar_g: total("sugar_g"),
    calories_burned: caloriesBurned,
    hit_target: targetCalories > 0 && Math.abs(totalCalories - targetCalories) <= targetCalories * 0.1,
    logged_at_least_once: logs?.length > 0,
  }, { onConflict: "user_id,summary_date" });
  if (error) throw new ApiError(400, error.message, "summary_save_failed");
  return profile?.timezone ?? "UTC";
}

async function refreshStreak(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, logDate: string) {
  const { data: existing, error: fetchError } = await supabase.from("streaks").select("current_streak, longest_streak, last_log_date").eq("user_id", userId).maybeSingle();
  if (fetchError) throw new ApiError(400, fetchError.message, "streak_fetch_failed");
  const next = updateStreak({ currentStreak: Number(existing?.current_streak ?? 0), longestStreak: Number(existing?.longest_streak ?? 0), lastLogDate: existing?.last_log_date ?? null }, logDate);
  const { error } = await supabase.from("streaks").upsert({ user_id: userId, current_streak: next.currentStreak, longest_streak: next.longestStreak, last_log_date: next.lastLogDate });
  if (error) throw new ApiError(400, error.message, "streak_save_failed");
}

function localDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
