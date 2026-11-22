import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { badgesForProgress } from "@/lib/badges";
import { computeNutrients } from "@/lib/food";
import { foodLogRequestSchema } from "@/lib/food-log-schemas";
import { isSafeFoodPhotoUrl } from "@/lib/image-security";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { updateStreak } from "@/lib/streaks";

const isoDateQuerySchema = z.iso.date();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const requestBody = await parseJson(request, foodLogRequestSchema);
    const isBatch = Array.isArray(requestBody);
    const bodies = isBatch ? requestBody : [requestBody];
    for (const body of bodies) {
      if (body.timezone) {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: body.timezone }).format();
        } catch {
          throw new ApiError(400, "Timezone must be a valid IANA timezone.", "invalid_timezone");
        }
      }
      if (body.photoUrl && !isSafeFoodPhotoUrl(body.photoUrl, user.id)) {
        throw new ApiError(400, "Photo URL must belong to your uploaded food photos.", "invalid_photo_url");
      }
    }

    const rows = bodies.map((body) => {
      const computed = computeNutrients(body.weightG, body.nutrientRate);
      return {
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
        is_recipe: body.isRecipe,
        photo_url: body.photoUrl ?? null,
      };
    });
    const insertResult = isBatch
      ? await supabase.from("food_logs").insert(rows).select()
      : await supabase.from("food_logs").insert(rows[0]).select().single();

    if (insertResult.error) throw new ApiError(400, "Unable to save food log.", "food_log_save_failed");
    const logs = Array.isArray(insertResult.data)
      ? insertResult.data
      : insertResult.data
        ? [insertResult.data]
        : [];
    for (const logDate of new Set(bodies.map((body) => body.logDate))) {
      const profileTimezone = await refreshDailySummary(supabase, user.id, logDate);
      const shouldRefreshStreak = bodies.some((body) =>
        body.logDate === logDate && body.logDate === localDate(body.timezone ?? profileTimezone),
      );
      if (shouldRefreshStreak) await refreshStreak(supabase, user.id, logDate);
    }
    try {
      await awardBadges(supabase, user.id);
    } catch (error) {
      logger.error("badge_award_failed_after_food_log", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
    return Response.json(isBatch ? { logs } : { log: logs[0] }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function awardBadges(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [{ count, error: countError }, { data: streak, error: streakError }] = await Promise.all([
    supabase.from("food_logs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
  ]);
  if (countError || streakError) throw new ApiError(400, "Unable to update badges.", "badge_award_failed");
  const candidates = badgesForProgress(count ?? 0, Number(streak?.current_streak ?? 0));
  if (candidates.length === 0) return;

  // Award badges via service_role so authenticated users cannot forge arbitrary badges via PostgREST.
  const writer = (() => {
    try {
      return createAdminClient();
    } catch {
      return supabase;
    }
  })();

  const { error } = await writer
    .from("badges")
    .upsert(
      candidates.map((badge) => ({ user_id: userId, badge_key: badge.badgeKey })),
      { onConflict: "user_id,badge_key", ignoreDuplicates: true },
    );
  if (error) throw new ApiError(400, "Unable to update badges.", "badge_award_failed");
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const params = new URL(request.url).searchParams;
    const rawDate = params.get("date");
    const rawFrom = params.get("from");
    const rawTo = params.get("to");

    const date = rawDate ? parseIsoDateParam(rawDate, "date") : null;
    const from = rawFrom ? parseIsoDateParam(rawFrom, "from") : null;
    const to = rawTo ? parseIsoDateParam(rawTo, "to") : null;

    const query = supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    const filtered = date
      ? query.eq("log_date", date)
      : query.gte("log_date", from ?? "1900-01-01").lte("log_date", to ?? "2999-12-31");
    const { data: logs, error } = await filtered;
    if (error) throw new ApiError(400, "Unable to load food logs.", "food_log_fetch_failed");
    return Response.json({ logs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function parseIsoDateParam(value: string, label: string): string {
  const parsed = isoDateQuerySchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, `Invalid ${label} date format. Expected YYYY-MM-DD.`, "invalid_date");
  }
  return parsed.data;
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
  if (error) throw new ApiError(400, "Unable to save daily summary.", "summary_save_failed");
  return profile?.timezone ?? "UTC";
}

async function refreshStreak(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, logDate: string) {
  const { data: existing, error: fetchError } = await supabase.from("streaks").select("current_streak, longest_streak, last_log_date").eq("user_id", userId).maybeSingle();
  if (fetchError) throw new ApiError(400, "Unable to load streak.", "streak_fetch_failed");
  const next = updateStreak({ currentStreak: Number(existing?.current_streak ?? 0), longestStreak: Number(existing?.longest_streak ?? 0), lastLogDate: existing?.last_log_date ?? null }, logDate);
  const { error } = await supabase.from("streaks").upsert({ user_id: userId, current_streak: next.currentStreak, longest_streak: next.longestStreak, last_log_date: next.lastLogDate });
  if (error) throw new ApiError(400, "Unable to save streak.", "streak_save_failed");
}

function localDate(timezone: string): string {
  let safeTz = "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
    safeTz = timezone;
  } catch {
    safeTz = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: safeTz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
