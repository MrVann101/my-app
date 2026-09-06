import { apiErrorResponse, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new ApiError(400, profileError.message, "profile_fetch_failed");
    if (!profile) return Response.json({ date: null, needsOnboarding: true });

    const date = localDate(profile.timezone);
    const [{ data: logs, error: logsError }, { data: exercise, error: exerciseError }, { data: streak, error: streakError }] = await Promise.all([
      supabase.from("food_logs").select("*").eq("user_id", user.id).eq("log_date", date).order("created_at", { ascending: true }),
      supabase.from("exercise_logs").select("calories_burned").eq("user_id", user.id).eq("log_date", date),
      supabase.from("streaks").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
    ]);
    if (logsError || exerciseError || streakError) throw new ApiError(400, "Unable to load today’s dashboard.", "dashboard_fetch_failed");

    const sum = (key: "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sodium_mg" | "sugar_g") => (logs ?? []).reduce((total, log) => total + Number(log[key] ?? 0), 0);
    const caloriesBurned = (exercise ?? []).reduce((total, item) => total + Number(item.calories_burned ?? 0), 0);
    const targetCalories = Number(profile.target_calories ?? 0);
    const caloriesConsumed = sum("calories");

    return Response.json({
      date,
      needsOnboarding: false,
      targetCalories,
      caloriesConsumed,
      caloriesBurned,
      caloriesRemaining: targetCalories - caloriesConsumed + caloriesBurned,
      macros: { proteinG: sum("protein_g"), carbsG: sum("carbs_g"), fatG: sum("fat_g"), fiberG: sum("fiber_g"), sodiumMg: sum("sodium_mg"), sugarG: sum("sugar_g"), targetProteinG: Number(profile.target_protein_g ?? 0), targetCarbsG: Number(profile.target_carbs_g ?? 0), targetFatG: Number(profile.target_fat_g ?? 0) },
      logs: logs ?? [],
      streak: streak ?? { current_streak: 0, longest_streak: 0 },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function localDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
