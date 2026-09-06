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
const email = `ai_global_${suffix}@example.com`;
const password = "BitewiseGlobalLimitTest123!";
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

  const bucket = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const first = await client.rpc("claim_global_ai_rate_limit", { p_bucket_start: bucket, p_limit: 2 });
  const second = await client.rpc("claim_global_ai_rate_limit", { p_bucket_start: bucket, p_limit: 2 });
  const third = await client.rpc("claim_global_ai_rate_limit", { p_bucket_start: bucket, p_limit: 2 });
  if (first.error || second.error || third.error) throw first.error ?? second.error ?? third.error;
  assert(first.data === true && second.data === true && third.data === false, "The global AI rate limit did not enforce the configured bucket limit.");
  console.log("Global AI rate-limit verification passed: two claims allowed and the third denied in one shared bucket.");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
