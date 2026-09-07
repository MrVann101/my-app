import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

try {
  const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.BITEWISE_TEST_BASE_URL ?? "http://localhost:3100";
const cronSecret = process.env.CRON_SECRET ?? "retention-test-secret";
if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase credentials are required.");
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
let userId;
function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  const created = await admin.auth.admin.createUser({ email: `retention_${suffix}@example.com`, password: "BitewiseRetentionTest123!", email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const profile = await admin.from("profiles").insert({ user_id: userId, username: `retention_${suffix.slice(-12)}`, timezone: "UTC", target_calories: 2000 });
  if (profile.error) throw profile.error;
  const oldLog = await admin.from("food_logs").insert({ user_id: userId, log_date: "2026-08-06", food_name: "Expired detail", weight_g: 100, calories_per_g: 1, calories: 100 });
  if (oldLog.error) throw oldLog.error;
  const boundaryLog = await admin.from("food_logs").insert({ user_id: userId, log_date: "2026-08-07", food_name: "Boundary detail", weight_g: 100, calories_per_g: 1, calories: 100 });
  if (boundaryLog.error) throw boundaryLog.error;
  const summary = await admin.from("daily_summaries").insert({ user_id: userId, summary_date: "2026-08-06", total_calories: 100, logged_at_least_once: true });
  if (summary.error) throw summary.error;

  const response = await fetch(`${baseUrl}/api/cron/purge-detailed-logs`, { headers: { Authorization: `Bearer ${cronSecret}` } });
  const payload = await response.json();
  assert(response.ok, `Retention route failed: ${response.status}`);

  const logs = await admin.from("food_logs").select("food_name").eq("user_id", userId).order("log_date");
  if (logs.error) throw logs.error;
  assert(logs.data.length === 1 && logs.data[0].food_name === "Boundary detail", "Retention purge deleted the wrong detail rows.");
  const summaryCheck = await admin.from("daily_summaries").select("total_calories").eq("user_id", userId).eq("summary_date", "2026-08-06").single();
  if (summaryCheck.error) throw summaryCheck.error;
  assert(Number(summaryCheck.data.total_calories) === 100, "Retention purge deleted or changed the permanent summary.");
  console.log(`Retention purge verification passed: ${payload.deleted} expired detail row removed, boundary row and permanent summary preserved.`);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
