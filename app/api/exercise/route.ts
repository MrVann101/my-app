import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const exerciseSchema = z.object({ logDate: z.iso.date(), activityName: z.string().trim().min(1).max(200), caloriesBurned: z.number().finite().nonnegative().max(10000) });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = await parseJson(request, exerciseSchema);
    const { data: log, error } = await supabase.from("exercise_logs").insert({ user_id: user.id, log_date: body.logDate, activity_name: body.activityName, calories_burned: body.caloriesBurned }).select().single();
    if (error) throw new ApiError(400, error.message, "exercise_save_failed");
    return Response.json({ log }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const params = new URL(request.url).searchParams;
    const { data: logs, error } = await supabase.from("exercise_logs").select("*").eq("user_id", user.id).gte("log_date", params.get("from") ?? "1900-01-01").lte("log_date", params.get("to") ?? "2999-12-31").order("log_date", { ascending: false });
    if (error) throw new ApiError(400, error.message, "exercise_fetch_failed");
    return Response.json({ logs });
  } catch (error) { return apiErrorResponse(error); }
}
