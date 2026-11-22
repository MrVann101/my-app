import { z } from "zod";
import { apiErrorResponse, parseJson } from "@/lib/api";
import { escapeIlike } from "@/lib/image-security";
import { claimRateLimit, getTrustedClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToInternalEmail } from "@/lib/username-auth";

const USERNAME_RE = /^[a-zA-Z0-9_]{2,30}$/;

const loginSchema = z
  .object({
    username: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(1).max(72),
  })
  .refine((data) => Boolean(data.username || data.email), {
    message: "Username is required.",
  });

export async function POST(request: Request) {
  try {
    const { username, email, password } = await parseJson(request, loginSchema);
    const identifier = (username ?? email ?? "").trim();

    const clientIp = getTrustedClientIp(request);
    await claimRateLimit({
      key: `login:ip:${clientIp}`,
      windowSeconds: 900,
      limit: 30,
      message: "Too many sign-in attempts. Please wait a few minutes and try again.",
    });
    await claimRateLimit({
      key: `login:id:${identifier.toLowerCase()}`,
      windowSeconds: 900,
      limit: 15,
      message: "Too many sign-in attempts for this account. Please wait a few minutes and try again.",
    });

    const supabase = await createClient();

    if (identifier.includes("@")) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });
      if (!error && data.user) {
        return Response.json({ userId: data.user.id });
      }
      return Response.json(
        { error: { code: "login_failed", message: "Username or password is incorrect." } },
        { status: 401 },
      );
    }

    if (!USERNAME_RE.test(identifier)) {
      return Response.json(
        { error: { code: "login_failed", message: "Username or password is incorrect." } },
        { status: 401 },
      );
    }

    const internalEmail = usernameToInternalEmail(identifier);
    const primaryAttempt = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    if (!primaryAttempt.error && primaryAttempt.data.user) {
      return Response.json({ userId: primaryAttempt.data.user.id });
    }

    // Fallback for legacy accounts created before username-only registration (e.g. alex_demo).
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("username", escapeIlike(identifier))
      .maybeSingle();

    if (!profileError && profile?.user_id) {
      const { data: userRecord } = await admin.auth.admin.getUserById(profile.user_id);
      const legacyEmail = userRecord?.user?.email;
      if (legacyEmail && legacyEmail.toLowerCase() !== internalEmail) {
        const legacyAttempt = await supabase.auth.signInWithPassword({
          email: legacyEmail,
          password,
        });
        if (!legacyAttempt.error && legacyAttempt.data.user) {
          return Response.json({ userId: legacyAttempt.data.user.id });
        }
      }
    }

    return Response.json(
      { error: { code: "login_failed", message: "Username or password is incorrect." } },
      { status: 401 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
