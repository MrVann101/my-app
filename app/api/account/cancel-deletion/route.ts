import { apiErrorResponse, ApiError } from "@/lib/api";
import { canCancelDeletion } from "@/lib/deletion";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { data: profile, error: fetchError } = await supabase.from("profiles").select("deletion_requested_at").eq("user_id", user.id).single();
    if (fetchError) throw new ApiError(400, fetchError.message, "deletion_status_failed");
    if (!profile.deletion_requested_at || !canCancelDeletion(profile.deletion_requested_at, Date.now())) throw new ApiError(400, "This deletion request can no longer be cancelled.", "deletion_window_closed");
    const { error } = await supabase.from("profiles").update({ deletion_requested_at: null }).eq("user_id", user.id);
    if (error) throw new ApiError(400, error.message, "deletion_cancel_failed");
    return Response.json({ cancelled: true });
  } catch (error) { return apiErrorResponse(error); }
}
