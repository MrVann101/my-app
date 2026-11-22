import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const envFile = new URL("../.env.local", import.meta.url);
try {
  const contents = await readFile(envFile, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Hosted env
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const adminPassword = process.env.BITEWISE_INITIAL_ADMIN_PASSWORD?.trim();
const resetPassword = process.argv.includes("--reset-password");
if (!adminPassword || adminPassword.length < 16) {
  throw new Error(
    "Set BITEWISE_INITIAL_ADMIN_PASSWORD (minimum 16 characters) before running create-admin-user.mjs.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const adminUsername = "admin";
const adminInternalEmail = "admin@users.bitewise.local";

async function findUserByEmailOrUsername(email, username) {
  for (let page = 1; page <= 25; page += 1) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = list?.users ?? [];
    const found = users.find(
      (u) =>
        u.email?.toLowerCase() === email.toLowerCase() ||
        String(u.user_metadata?.username ?? "").toLowerCase() === username.toLowerCase(),
    );
    if (found) return found;
    if (users.length < 200) break;
  }
  return null;
}

const existingAdmin = await findUserByEmailOrUsername(adminInternalEmail, adminUsername);

let adminUserId;
if (existingAdmin) {
  adminUserId = existingAdmin.id;
  const cleanedUserMeta = { ...(existingAdmin.user_metadata ?? {}) };
  delete cleanedUserMeta.is_admin;

  const updatePayload = {
    email: adminInternalEmail,
    email_confirm: true,
    app_metadata: {
      ...(existingAdmin.app_metadata ?? {}),
      is_admin: true,
    },
    user_metadata: {
      ...cleanedUserMeta,
      username: adminUsername,
      accepted_terms_at: cleanedUserMeta.accepted_terms_at ?? new Date().toISOString(),
    },
  };
  if (resetPassword) {
    updatePayload.password = adminPassword;
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(adminUserId, updatePayload);
  if (updErr) throw updErr;
  console.log(
    `Updated dedicated @admin account (${adminUserId})${resetPassword ? " with new password" : " (password preserved; pass --reset-password to rotate)"}.`,
  );
} else {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: adminInternalEmail,
    password: adminPassword,
    email_confirm: true,
    app_metadata: {
      is_admin: true,
    },
    user_metadata: {
      username: adminUsername,
      accepted_terms_at: new Date().toISOString(),
    },
  });
  if (createErr) throw createErr;
  adminUserId = created.user.id;
  console.log(`Created dedicated @admin account (${adminUserId}).`);
}

const { data: existingProfile } = await admin
  .from("profiles")
  .select("user_id")
  .eq("user_id", adminUserId)
  .maybeSingle();

if (!existingProfile) {
  const { error: profErr } = await admin.from("profiles").insert({
    user_id: adminUserId,
    username: adminUsername,
    weight_kg: 70,
    height_cm: 175,
    age: 26,
    sex: "male",
    activity_level: "moderate",
    goal: "maintain",
    timezone: "Asia/Manila",
    bmr: 1669,
    tdee: 2587,
    target_calories: 2587,
    target_protein_g: 194,
    target_carbs_g: 259,
    target_fat_g: 86,
    is_admin: true,
  });
  if (profErr) throw profErr;
  console.log("Created profile row for @admin.");
} else {
  await admin.from("profiles").update({ is_admin: true }).eq("user_id", adminUserId);
}

console.log("Admin setup complete.");
