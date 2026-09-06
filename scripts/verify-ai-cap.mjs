import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

try {
  const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Hosted environments provide process environment variables directly.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase credentials are required.");

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = `ai_cap_${suffix}@example.com`;
const password = "BitewiseAiCapTest123!";
let userId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const usageDate = "2026-09-07";
  const first = await client.rpc("claim_ai_photo_slot", { p_user_id: userId, p_usage_date: usageDate });
  const second = await client.rpc("claim_ai_photo_slot", { p_user_id: userId, p_usage_date: usageDate });
  const third = await client.rpc("claim_ai_photo_slot", { p_user_id: userId, p_usage_date: usageDate });
  if (first.error || second.error || third.error) throw first.error ?? second.error ?? third.error;
  assert(first.data === true && second.data === true && third.data === false, "The AI photo cap did not enforce exactly two successful claims.");

  const released = await client.rpc("release_ai_photo_slot", { p_user_id: userId, p_usage_date: usageDate });
  if (released.error) throw released.error;
  const afterRelease = await client.rpc("claim_ai_photo_slot", { p_user_id: userId, p_usage_date: usageDate });
  if (afterRelease.error) throw afterRelease.error;
  assert(afterRelease.data === true, "Released AI photo slot could not be claimed again.");

  console.log("AI photo cap verification passed: two claims allowed, third denied, release restored one slot.");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
