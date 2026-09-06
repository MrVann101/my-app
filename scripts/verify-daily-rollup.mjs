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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required.");
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
let userId;
const summaryDate = "2026-09-06";
function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  const created = await admin.auth.admin.createUser({ email: `rollup_${suffix}@example.com`, password: "BitewiseRollupTest123!", email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const profile = await admin.from("profiles").insert({ user_id: userId, username: `rollup_${suffix.slice(-12)}`, timezone: "UTC", target_calories: 2000 });
  if (profile.error) throw profile.error;
  const food = await admin.from("food_logs").insert({ user_id: userId, log_date: summaryDate, food_name: "Rollup food", weight_g: 100, calories_per_g: 1.5, protein_per_g: 0.1, carbs_per_g: 0.2, fat_per_g: 0.05, fiber_per_g: 0.03, sodium_per_g: 0.004, sugar_per_g: 0.02, calories: 0 }).select("id").single();
  if (food.error) throw food.error;
  const exercise = await admin.from("exercise_logs").insert({ user_id: userId, log_date: summaryDate, activity_name: "Rollup walk", calories_burned: 100 });
  if (exercise.error) throw exercise.error;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await admin.rpc("rollup_daily_summary", { p_user_id: userId, p_summary_date: summaryDate });
    if (result.error) throw result.error;
  }
  const summary = await admin.from("daily_summaries").select("total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sodium_mg, total_sugar_g, calories_burned, hit_target, logged_at_least_once").eq("user_id", userId).eq("summary_date", summaryDate).single();
  if (summary.error) throw summary.error;
  const row = summary.data;
  assert(Number(row.total_calories) === 150, "Rollup calories mismatch.");
  assert(Number(row.total_protein_g) === 10 && Number(row.total_carbs_g) === 20 && Number(row.total_fat_g) === 5, "Rollup macro mismatch.");
  assert(Number(row.total_fiber_g) === 3 && Number(row.total_sodium_mg) === 0.4 && Number(row.total_sugar_g) === 2, "Rollup micronutrient mismatch.");
  assert(Number(row.calories_burned) === 100 && row.hit_target === false && row.logged_at_least_once === true, "Rollup exercise or flags mismatch.");
  console.log("Daily rollup verification passed: aggregates, tolerance flag, logged flag, and idempotent rerun are correct.");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
