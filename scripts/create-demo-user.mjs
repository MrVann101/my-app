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
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required.");

if (!process.argv.includes("--confirm-demo")) {
  throw new Error("Refusing to seed demo user without explicit --confirm-demo flag (never run against production).");
}

const password = process.env.BITEWISE_DEMO_PASSWORD?.trim();
if (!password || password.length < 12) {
  throw new Error("Set BITEWISE_DEMO_PASSWORD (minimum 12 characters) before running create-demo-user.mjs.");
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const email = "demo@bitewise.app";
const username = "alex_demo";

try {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = (list?.users ?? []).find((u) => u.email === email);

  let userId;
  if (existing) {
    console.log(`User ${email} already exists.`);
    userId = existing.id;
    if (process.argv.includes("--reset-password")) {
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    console.log(`Created user ${email} with ID: ${userId}`);
  }

  const { data: profile } = await admin.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!profile) {
    const inserted = await admin.from("profiles").insert({
      user_id: userId,
      username,
      weight_kg: 72,
      height_cm: 178,
      age: 26,
      sex: "male",
      activity_level: "moderate",
      goal: "maintain",
      timezone: "UTC",
      target_calories: 2200,
      target_protein_g: 165,
      target_carbs_g: 220,
      target_fat_g: 73,
    });
    if (inserted.error) throw inserted.error;
    console.log("Profile created for demo user.");
  } else {
    console.log("Profile already exists for demo user.");
  }

  console.log("Demo user account ready!");
} catch (err) {
  console.error("Failed to set up demo user:", err);
  process.exitCode = 1;
}
