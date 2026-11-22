import { apiErrorResponse, ApiError } from "@/lib/api";
import { sendDeletionConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";
import { claimRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isInternalAuthEmail } from "@/lib/username-auth";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    await claimRateLimit({
      key: `account_delete:${user.id}`,
      windowSeconds: 3600,
      limit: 5,
      message: "Too many account deletion requests. Please wait before trying again.",
    });

    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("deletion_requested_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw new ApiError(400, "Unable to check account deletion status.", "deletion_request_failed");
    if (existing?.deletion_requested_at) {
      return Response.json({ deletionRequestedAt: existing.deletion_requested_at });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .select("deletion_requested_at")
      .single();

    if (error) throw new ApiError(400, "Unable to schedule account deletion.", "deletion_request_failed");

    try {
      const deletionDate = new Date(
        new Date(profile.deletion_requested_at).getTime() + 14 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      if (user.email && !isInternalAuthEmail(user.email)) {
        await sendDeletionConfirmation(user.email, deletionDate);
      }
    } catch (emailError) {
      logger.warn("deletion_confirmation_email_failed", {
        error: emailError instanceof Error ? emailError.message : "unknown_error",
      });
    }

    return Response.json({ deletionRequestedAt: profile.deletion_requested_at });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
