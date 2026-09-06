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
  // CI and hosted environments provide process environment variables directly.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running RLS verification.");
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const password = "BitewiseRlsTestPassword123!";
const users = [
  { email: `rls_a_${suffix}@example.com`, username: `rls_a_${suffix.slice(-12)}` },
  { email: `rls_b_${suffix}@example.com`, username: `rls_b_${suffix.slice(-12)}` },
];
const clients = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createTestUser(user) {
  const { data, error } = await admin.auth.admin.createUser({ email: user.email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email: user.email, password });
  if (signIn.error) throw signIn.error;
  clients.push(client);
  return { id: data.user.id, client };
}

let first;
let second;
try {
  first = await createTestUser(users[0]);
  second = await createTestUser(users[1]);

  for (const [index, entry] of [first, second].entries()) {
    const { error } = await entry.client.from("profiles").insert({ user_id: entry.id, username: users[index].username, timezone: "UTC" });
    if (error) throw error;
  }

  const privatePlan = await first.client.from("meal_plans").insert({ user_id: first.id, name: "Private verification plan", visibility: "private" }).select("id").single();
  if (privatePlan.error) throw privatePlan.error;
  const item = await first.client.from("meal_plan_items").insert({ plan_id: privatePlan.data.id, food_name: "Rice", weight_g: 100, calories_per_g: 1.3, calories: 999 }).select("calories").single();
  if (item.error) throw item.error;
  assert(Number(item.data.calories) === 130, "Computed meal-plan calories were not enforced.");

  const hiddenPlan = await second.client.from("meal_plans").select("id").eq("id", privatePlan.data.id);
  if (hiddenPlan.error) throw hiddenPlan.error;
  assert(hiddenPlan.data.length === 0, "User B could read User A's private meal plan.");

  const published = await first.client.from("meal_plans").update({ visibility: "public" }).eq("id", privatePlan.data.id);
  if (published.error) throw published.error;
  const visiblePlan = await second.client.from("meal_plans").select("id").eq("id", privatePlan.data.id);
  if (visiblePlan.error) throw visiblePlan.error;
  assert(visiblePlan.data.length === 1, "User B could not read a public meal plan.");

  const customFood = await first.client.from("custom_foods").insert({ user_id: first.id, food_name: "Private sauce", default_weight_g: 20, calories_per_g: 2, label_calories: 40, label_weight_g: 20 }).select("id").single();
  if (customFood.error) throw customFood.error;
  const hiddenFood = await second.client.from("custom_foods").select("id").eq("id", customFood.data.id);
  if (hiddenFood.error) throw hiddenFood.error;
  assert(hiddenFood.data.length === 0, "User B could read User A's custom food.");

  const log = await first.client.from("food_logs").insert({ user_id: first.id, log_date: "2026-09-06", food_name: "Eggs", weight_g: 100, calories_per_g: 1.43, calories: 0 }).select("calories").single();
  if (log.error) throw log.error;
  assert(Number(log.data.calories) === 143, "Computed food-log calories were not enforced.");

  console.log("RLS verification passed: private rows are isolated, public plans are readable, custom foods remain private, and computed totals are enforced.");
} finally {
  for (const user of [first, second]) {
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}
