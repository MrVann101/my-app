import { apiErrorResponse, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const labels: Record<string, string> = { first_log: "First log", ten_logs: "Ten logs", seven_day_streak: "Seven-day streak" };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { data: badges, error } = await supabase.from("badges").select("badge_key, earned_at").eq("user_id", user.id).order("earned_at", { ascending: false });
    if (error) throw new ApiError(400, error.message, "badge_fetch_failed");
    return Response.json({ badges: (badges ?? []).map((badge) => ({ ...badge, label: labels[badge.badge_key] ?? badge.badge_key })) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
