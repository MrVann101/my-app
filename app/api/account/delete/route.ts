import { apiErrorResponse, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { sendDeletionConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { data: profile, error } = await supabase.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("user_id", user.id).select("deletion_requested_at").single();
    if (error) throw new ApiError(400, error.message, "deletion_request_failed");
    try {
      const deletionDate = new Date(new Date(profile.deletion_requested_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (user.email) await sendDeletionConfirmation(user.email, deletionDate);
    } catch (emailError) {
      logger.warn("deletion_confirmation_email_failed", { error: emailError instanceof Error ? emailError.message : "unknown_error" });
    }
    return Response.json({ deletionRequestedAt: profile.deletion_requested_at });
  } catch (error) { return apiErrorResponse(error); }
}
