import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { analyzeFoodText } from "@/lib/ai-text";
import { createClient } from "@/lib/supabase/server";

const descriptionSchema = z.object({ description: z.string().trim().min(3).max(2_000) });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { description } = await parseJson(request, descriptionSchema);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new ApiError(400, profileError.message, "profile_fetch_failed");
    const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: profile?.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const usageDate = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
    const { data: allowed, error: usageError } = await supabase.rpc("claim_ai_text_slot", { p_user_id: user.id, p_usage_date: usageDate });
    if (usageError) throw new ApiError(503, "Text analysis is not configured yet. Apply the AI text usage migration first.", "ai_text_usage_unavailable");
    if (!allowed) throw new ApiError(429, "You have reached today’s text-analysis limit. Use search or manual entry instead.", "daily_text_cap");
    return Response.json(await analyzeFoodText(description));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
