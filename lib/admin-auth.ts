import type { User } from "@supabase/supabase-js";
import { ApiError } from "./api";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

export function parseAdminUserIds(raw: string | undefined = process.env.ADMIN_USER_IDS): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

export function resolveUsername(
  user: Pick<User, "email" | "user_metadata">,
  profileRow?: Record<string, unknown> | null,
): string {
  if (profileRow && typeof profileRow.username === "string" && profileRow.username.trim()) {
    return profileRow.username.trim();
  }
  if (typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim()) {
    return user.user_metadata.username.trim();
  }
  if (user.email) {
    return user.email.split("@")[0] || "member";
  }
  return "member";
}

/**
 * Authorizes admin privileges strictly from server-controlled sources:
 * 1. `user.app_metadata.is_admin === true` (service_role-only in Supabase Auth)
 * 2. `profiles.is_admin === true` (protected by column revoke + BEFORE trigger in 0025)
 * 3. Optional immutable UUID allowlist `ADMIN_USER_IDS`
 *
 * Client-writable `user.user_metadata` is NEVER trusted for authorization.
 */
export function resolveIsAdmin({
  user,
  profileRow,
  adminUserIdsEnv = process.env.ADMIN_USER_IDS,
}: {
  user: Pick<User, "id" | "app_metadata"> | null;
  profileRow?: Record<string, unknown> | null;
  adminUserIdsEnv?: string | undefined;
}): boolean {
  if (!user) return false;
  if (user.app_metadata?.is_admin === true) return true;
  if (profileRow && profileRow.is_admin === true) return true;

  const allowedIds = parseAdminUserIds(adminUserIdsEnv);
  if (user.id && allowedIds.has(user.id.toLowerCase())) return true;

  return false;
}

export async function getSessionWithAdminCheck() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null, username: "", isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileRow = (profile as Record<string, unknown> | null) ?? null;
  const username = resolveUsername(user, profileRow);
  const isAdmin = resolveIsAdmin({ user, profileRow });

  return { supabase, user, profile: profileRow, username, isAdmin };
}

export async function requireAdmin() {
  const { user, profile, username, isAdmin } = await getSessionWithAdminCheck();
  if (!user) {
    throw new ApiError(401, "Authentication is required.", "unauthorized");
  }
  if (!isAdmin) {
    throw new ApiError(403, "Admin access is required.", "forbidden");
  }
  return {
    user,
    profile,
    username,
    admin: createAdminClient(),
  };
}
