import { apiErrorResponse, ApiError } from "@/lib/api";
import { getMealSuggestions } from "@/lib/suggestions";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("timezone, target_calories, target_protein_g, target_carbs_g, target_fat_g").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new ApiError(400, profileError.message, "profile_fetch_failed");
    if (!profile) return Response.json({ suggestions: [], providerUsed: "fallback", needsOnboarding: true });
    const date = localDate(profile.timezone ?? "UTC");
    const { data: logs, error } = await supabase.from("food_logs").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).eq("log_date", date);
    if (error) throw new ApiError(400, error.message, "food_log_fetch_failed");
    const sum = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") => (logs ?? []).reduce((total, log) => total + Number(log[key] ?? 0), 0);
    return Response.json(await getMealSuggestions({ calories: Number(profile.target_calories ?? 0) - sum("calories"), proteinG: Number(profile.target_protein_g ?? 0) - sum("protein_g"), carbsG: Number(profile.target_carbs_g ?? 0) - sum("carbs_g"), fatG: Number(profile.target_fat_g ?? 0) - sum("fat_g") }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function localDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
