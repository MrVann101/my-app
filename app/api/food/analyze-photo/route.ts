import { apiErrorResponse, ApiError } from "@/lib/api";
import { analyzeFoodImage, validateFoodImage } from "@/lib/ai-food";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let claimedDate: string | null = null;
  let userId: string | null = null;
  let claimedSlot = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    userId = user.id;

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) throw new ApiError(400, "Upload an image to analyze.", "image_required");

    const { data: profile, error: profileError } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new ApiError(400, profileError.message, "profile_fetch_failed");
    const timezone = profile?.timezone ?? "UTC";
    claimedDate = localDate(timezone);
    const { data: claimed, error: claimError } = await supabase.rpc("claim_ai_photo_slot", { p_user_id: user.id, p_usage_date: claimedDate });
    if (claimError) throw new ApiError(503, "Photo analysis is not configured yet. Apply the AI usage migration first.", "ai_usage_unavailable");
    if (!claimed) throw new ApiError(429, "You have used both AI photo analyses for today. Use search or manual entry instead.", "daily_photo_cap");
    claimedSlot = true;

    const bucketStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const { data: globallyAllowed, error: globalLimitError } = await supabase.rpc("claim_global_ai_rate_limit", { p_bucket_start: bucketStart, p_limit: 60 });
    if (globalLimitError) throw new ApiError(503, "Photo analysis is not configured yet. Apply the global AI limit migration first.", "ai_rate_limit_unavailable");
    if (!globallyAllowed) {
      await supabase.rpc("release_ai_photo_slot", { p_user_id: user.id, p_usage_date: claimedDate });
      claimedSlot = false;
      throw new ApiError(429, "Photo analysis is busy right now. Try again shortly or use search/manual entry.", "global_ai_rate_limit");
    }

    const validated = await validateFoodImage(image);
    const analysis = await analyzeFoodImage(validated);
    return Response.json(analysis);
  } catch (error) {
    if (claimedSlot && claimedDate && userId) {
      try {
        const supabase = await createClient();
        await supabase.rpc("release_ai_photo_slot", { p_user_id: userId, p_usage_date: claimedDate });
      } catch {
        // The original analysis error is more useful to the client than release cleanup failure.
      }
    }
    return apiErrorResponse(error);
  }
}

function localDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
