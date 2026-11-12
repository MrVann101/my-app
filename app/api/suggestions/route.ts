import { apiErrorResponse, ApiError } from "@/lib/api";
import { dateInTimezone } from "@/lib/date";
import { getMealSuggestions } from "@/lib/suggestions";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("timezone, target_calories, target_protein_g, target_carbs_g, target_fat_g").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new ApiError(400, profileError.message, "profile_fetch_failed");
    if (!profile) return Response.json({ suggestions: [], providerUsed: "fallback", needsOnboarding: true });
    const timezone = requestedTimezone(request, profile.timezone ?? "UTC");
    const date = dateInTimezone(new Date(), timezone);
    const [{ data: logs, error: logsError }, { data: exercises, error: exerciseError }] = await Promise.all([
      supabase.from("food_logs").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).eq("log_date", date),
      supabase.from("exercise_logs").select("calories_burned").eq("user_id", user.id).eq("log_date", date),
    ]);
    if (logsError || exerciseError) throw new ApiError(400, "Unable to calculate your remaining calorie budget.", "calorie_budget_fetch_failed");
    const sum = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") => (logs ?? []).reduce((total, log) => total + Number(log[key] ?? 0), 0);
    const caloriesBurned = (exercises ?? []).reduce((total, exercise) => total + Number(exercise.calories_burned ?? 0), 0);
    const calories = Number(profile.target_calories ?? 0) - sum("calories") + caloriesBurned;
    const params = new URL(request.url).searchParams;
    const excludedTitles = params.getAll("exclude").slice(0, 12);
    const requestedGeneration = Number(params.get("generation") ?? 0);
    const generation = Number.isInteger(requestedGeneration) && requestedGeneration > 0 ? requestedGeneration : 0;
    const result = await getMealSuggestions(
      { calories, proteinG: Number(profile.target_protein_g ?? 0) - sum("protein_g"), carbsG: Number(profile.target_carbs_g ?? 0) - sum("carbs_g"), fatG: Number(profile.target_fat_g ?? 0) - sum("fat_g") },
      excludedTitles,
      generation,
    );
    return Response.json({ ...result, date, timezone, remainingCalories: calories });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function requestedTimezone(request: Request, profileTimezone: string): string {
  const timezone = new URL(request.url).searchParams.get("timezone") ?? profileTimezone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new ApiError(400, "Timezone must be a valid IANA timezone.", "invalid_timezone");
  }
  return timezone;
}
