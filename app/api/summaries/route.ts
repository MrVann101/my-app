import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const dateSchema = z.iso.date();

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const params = new URL(request.url).searchParams;
    const fromResult = dateSchema.safeParse(params.get("from"));
    const toResult = dateSchema.safeParse(params.get("to"));
    if (!fromResult.success || !toResult.success) throw new ApiError(400, "A valid from and to date are required.", "invalid_date_range");
    const from = fromResult.data;
    const to = toResult.data;
    if (from > to) throw new ApiError(400, "The from date must be before the to date.", "invalid_date_range");
    const { data: summaries, error } = await supabase.from("daily_summaries").select("*").eq("user_id", user.id).gte("summary_date", from).lte("summary_date", to).order("summary_date", { ascending: true });
    if (error) throw new ApiError(400, error.message, "summary_fetch_failed");
    return Response.json({ summaries });
  } catch (error) { return apiErrorResponse(error); }
}
