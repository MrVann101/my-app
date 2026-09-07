import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { buildWeeklySummary } from "@/lib/weekly-summary";
import { createClient } from "@/lib/supabase/server";

const dateSchema = z.iso.date();

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const requestedEnd = new URL(request.url).searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
    const parsedEnd = dateSchema.safeParse(requestedEnd);
    if (!parsedEnd.success) throw new ApiError(400, "A valid end date is required.", "invalid_date");
    const to = parsedEnd.data;
    const from = subtractDays(to, 6);
    const { data: rows, error } = await supabase.from("daily_summaries").select("summary_date, total_calories, calories_burned, total_protein_g, hit_target, logged_at_least_once").eq("user_id", user.id).gte("summary_date", from).lte("summary_date", to).order("summary_date", { ascending: true });
    if (error) throw new ApiError(400, error.message, "weekly_summary_fetch_failed");
    return Response.json({ from, to, days: rows ?? [], summary: buildWeeklySummary(rows ?? []) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
