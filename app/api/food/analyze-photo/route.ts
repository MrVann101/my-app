import { apiErrorResponse, ApiError } from "@/lib/api";
import { AiFoodError, analyzeFoodImage, validateFoodImage } from "@/lib/ai-food";
import { logger } from "@/lib/logger";
import { claimGlobalAiRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_CONTENT_LENGTH_BYTES = 10 * 1024 * 1024 + 256 * 1024;

export async function POST(request: Request) {
  let claimedDate: string | null = null;
  let userId: string | null = null;
  let claimedSlot = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    userId = user.id;

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH_BYTES) {
      throw new ApiError(413, "Image must be 10 MB or smaller.", "invalid_food_image");
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) throw new ApiError(400, "Upload an image to analyze.", "image_required");

    // Validate file type, size, and real magic bytes BEFORE claiming daily or global AI rate-limit slots.
    const validated = await validateFoodImage(image);

    const { data: profile, error: profileError } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new ApiError(400, "Unable to load profile.", "profile_fetch_failed");
    const timezone = profile?.timezone ?? "UTC";
    claimedDate = localDate(timezone);

    const admin = createAdminClient();
    let { data: claimed, error: claimError } = await admin.rpc("claim_ai_photo_slot", {
      p_user_id: user.id,
      p_usage_date: claimedDate,
    });
    if (claimError && /not authorized/i.test(claimError.message ?? "")) {
      const fallback = await supabase.rpc("claim_ai_photo_slot", {
        p_user_id: user.id,
        p_usage_date: claimedDate,
      });
      claimed = fallback.data;
      claimError = fallback.error;
    }
    if (claimError) throw new ApiError(503, "Photo analysis is not configured yet. Apply the AI usage migration first.", "ai_usage_unavailable");
    if (!claimed) throw new ApiError(429, "You have used both AI photo analyses for today. Use search or manual entry instead.", "daily_photo_cap");
    claimedSlot = true;

    const globallyAllowed = await claimGlobalAiRateLimit(60, supabase);
    if (!globallyAllowed) {
      const releaseRes = await admin.rpc("release_ai_photo_slot", { p_user_id: user.id, p_usage_date: claimedDate });
      if (releaseRes.error && /not authorized/i.test(releaseRes.error.message ?? "")) {
        await supabase.rpc("release_ai_photo_slot", { p_user_id: user.id, p_usage_date: claimedDate });
      }
      claimedSlot = false;
      throw new ApiError(429, "Photo analysis is busy right now. Try again shortly or use search/manual entry.", "global_ai_rate_limit");
    }

    const analysis = await analyzeFoodImage(validated);
    return Response.json(analysis);
  } catch (error) {
    const shouldRefundSlot =
      claimedSlot &&
      claimedDate &&
      userId &&
      error instanceof AiFoodError &&
      error.retryable;

    if (shouldRefundSlot) {
      try {
        const admin = createAdminClient();
        const releaseRes = await admin.rpc("release_ai_photo_slot", { p_user_id: userId, p_usage_date: claimedDate });
        if (releaseRes?.error && /not authorized/i.test(releaseRes.error.message ?? "")) {
          const supabase = await createClient();
          await supabase.rpc("release_ai_photo_slot", { p_user_id: userId, p_usage_date: claimedDate });
        }
      } catch {
        // The original analysis error is more useful to the client than release cleanup failure.
      }
    }
    if (error instanceof AiFoodError) {
      if (error.retryable) {
        logger.error("photo_analysis_failed", {
          error: error.message,
          primary_provider_error: errorMessage(error.cause),
          fallback_provider_error: errorMessage(error.fallbackCause),
        });
      }
      return apiErrorResponse(new ApiError(
        error.retryable ? 503 : 400,
        error.message,
        error.retryable ? "photo_analysis_unavailable" : "invalid_food_image",
      ));
    }
    if (!(error instanceof ApiError)) {
      logger.error("photo_analysis_unexpected_error", { error: errorMessage(error) });
    }
    return apiErrorResponse(error);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
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
