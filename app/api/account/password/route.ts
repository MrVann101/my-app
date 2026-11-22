import { z } from "zod";
import { ApiError, apiErrorResponse, parseJson } from "@/lib/api";
import {
  checkPasswordRateLimit,
  clearFailedPasswordAttempts,
  recordFailedPasswordAttempt,
} from "@/lib/password-rate-limit";
import { claimRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToInternalEmail } from "@/lib/username-auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
  confirmPassword: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Authentication is required.", "unauthorized");
    }

    checkPasswordRateLimit(user.id);
    await claimRateLimit({
      key: `password_change:${user.id}`,
      windowSeconds: 900,
      limit: 10,
      message: "Too many password change attempts. Please wait 15 minutes and try again.",
    });

    const { currentPassword, newPassword, confirmPassword } = await parseJson(
      request,
      changePasswordSchema,
    );

    if (newPassword !== confirmPassword) {
      throw new ApiError(400, "New passwords do not match.", "password_mismatch");
    }

    if (newPassword === currentPassword) {
      throw new ApiError(
        400,
        "Choose a new password that is different from your current password.",
        "same_password",
      );
    }

    const email =
      user.email ||
      (typeof user.user_metadata?.username === "string"
        ? usernameToInternalEmail(user.user_metadata.username)
        : "");

    if (!email) {
      throw new ApiError(
        400,
        "Unable to resolve account identity for password verification.",
        "account_identity_missing",
      );
    }

    const { data: verified, error: verifyError } =
      await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

    if (verifyError || !verified.user || verified.user.id !== user.id) {
      recordFailedPasswordAttempt(user.id);
      throw new ApiError(
        400,
        "Current password is incorrect.",
        "invalid_current_password",
      );
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword },
    );

    if (updateError) {
      throw new ApiError(
        400,
        "Unable to update your password right now.",
        "password_update_failed",
      );
    }

    await supabase.auth.signInWithPassword({
      email,
      password: newPassword,
    });

    // Revoke any other active sessions so stolen sessions do not survive a password change.
    if (typeof supabase.auth.signOut === "function") {
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // Non-blocking if session scoping is unavailable.
      }
    }

    clearFailedPasswordAttempts(user.id);

    return Response.json({ updated: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
