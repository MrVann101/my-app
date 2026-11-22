import { z } from "zod";
import { apiErrorResponse, parseJson } from "@/lib/api";
import { escapeIlike } from "@/lib/image-security";
import { claimRateLimit, getTrustedClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToInternalEmail } from "@/lib/username-auth";

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "bitewise",
  "bitewise_admin",
  "bitewise_guest_feedback",
  "bitewise_team",
  "moderator",
  "root",
  "support",
  "system",
]);

const signupSchema = z.object({
  username: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().optional(),
  acceptedTerms: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { username, password, confirmPassword, acceptedTerms } = await parseJson(
      request,
      signupSchema,
    );

    if (confirmPassword !== undefined && confirmPassword !== password) {
      return Response.json(
        { error: { code: "password_mismatch", message: "Passwords do not match." } },
        { status: 400 },
      );
    }

    if (acceptedTerms !== true) {
      return Response.json(
        {
          error: {
            code: "terms_required",
            message:
              "Please confirm you are at least 13 and agree to the Terms & Conditions and Privacy Policy.",
          },
        },
        { status: 400 },
      );
    }

    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      return Response.json(
        { error: { code: "username_reserved", message: "That username is unavailable. Choose another one." } },
        { status: 400 },
      );
    }

    const clientIp = getTrustedClientIp(request);
    await claimRateLimit({
      key: `signup:ip:${clientIp}`,
      windowSeconds: 3600,
      limit: 10,
      message: "Too many sign-up attempts from this connection. Please try again later.",
    });

    const admin = createAdminClient();
    const internalEmail = usernameToInternalEmail(username);

    const { data: existingMatches, error: lookupError } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("username", escapeIlike(username))
      .limit(1);

    if (lookupError) {
      return Response.json(
        { error: { code: "signup_failed", message: "Unable to verify username availability." } },
        { status: 500 },
      );
    }

    if (existingMatches && existingMatches.length > 0) {
      return Response.json(
        { error: { code: "username_taken", message: "That username is already taken." } },
        { status: 400 },
      );
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        accepted_terms_at: new Date().toISOString(),
      },
    });

    if (createError || !created.user) {
      const errMsg = createError?.message ?? "";
      if (/already been registered|already exists|duplicate/i.test(errMsg)) {
        return Response.json(
          { error: { code: "username_taken", message: "That username is already taken." } },
          { status: 400 },
        );
      }
      return Response.json(
        { error: { code: "signup_failed", message: "Unable to create your account right now." } },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    if (signInError) {
      return Response.json(
        { error: { code: "signup_session_failed", message: "Account created. Please sign in to continue." } },
        { status: 400 },
      );
    }

    return Response.json({
      userId: created.user.id,
      verificationRequired: false,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
