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
const email = `ai_text_${suffix}@example.com`;
const password = "BitewiseAiTextTest123!";
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
  const results = [];
  for (let index = 0; index < 21; index += 1) {
    const result = await client.rpc("claim_ai_text_slot", { p_user_id: userId, p_usage_date: usageDate });
    if (result.error) throw result.error;
    results.push(result.data);
  }
  assert(results.slice(0, 20).every(Boolean) && results[20] === false, "The daily text-analysis cap did not enforce exactly 20 successful claims.");
  console.log("AI text cap verification passed: 20 claims allowed and the 21st denied.");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
