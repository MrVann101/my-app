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

  const selfAdminEscalate = await first.client.from("profiles").update({ is_admin: true }).eq("user_id", first.id);
  assert(selfAdminEscalate.error, "User A was able to self-escalate profiles.is_admin via PostgREST.");

  const directBadgeInsert = await first.client.from("badges").insert({ user_id: first.id, badge_key: "first_log" });
  assert(directBadgeInsert.error, "User A was able to directly forge a badge via PostgREST.");
  const crossUserBadge = await second.client.from("badges").insert({ user_id: first.id, badge_key: "first_log" });
  assert(crossUserBadge.error, "User B inserted a badge for User A.");

  const directQuotaReset = await first.client.from("daily_ai_usage").upsert({ user_id: first.id, usage_date: "2026-09-06", photo_count: 0, text_count: 0 });
  assert(directQuotaReset.error, "User A was able to write daily_ai_usage directly via PostgREST.");

  const directFeedbackForge = await first.client.from("app_feedback").insert({
    user_id: first.id,
    username_snapshot: "spoofed",
    overall_rating: 5,
    focus_area: "other",
    logging_ease: "very_easy",
    message: "Forged admin reply test",
    status: "shipped",
    admin_note: "Spoofed note",
  });
  assert(directFeedbackForge.error, "User A was able to insert directly into app_feedback via PostgREST.");

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

  const weeklyPlan = await first.client.from("weekly_plans").insert({
    user_id: first.id,
    name: "Private weekly verification plan",
    preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
    days: [],
  }).select("id").single();
  if (weeklyPlan.error) throw weeklyPlan.error;
  const hiddenWeeklyPlan = await second.client.from("weekly_plans").select("id").eq("id", weeklyPlan.data.id);
  if (hiddenWeeklyPlan.error) throw hiddenWeeklyPlan.error;
  assert(hiddenWeeklyPlan.data.length === 0, "User B could read User A's weekly plan.");
  const crossUserWeeklyPlan = await second.client.from("weekly_plans").insert({
    user_id: first.id,
    name: "Cross-user weekly plan",
    preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
    days: [],
  });
  assert(crossUserWeeklyPlan.error, "User B inserted a weekly plan for User A.");

  const weeklyMeal = await first.client.from("weekly_plan_meals").insert({
    weekly_plan_id: weeklyPlan.data.id,
    day_of_week: 1,
    day_name: "Monday",
    slot_index: 0,
    meal_slot: "Breakfast",
    title: "Oatmeal Bowl",
    description: "Warm oats with berries.",
    servings: 2,
    calories_per_serving: 250,
    protein_g_per_serving: 10,
    carbs_g_per_serving: 40,
    fat_g_per_serving: 5,
    total_calories: 0,
  }).select("total_calories").single();
  if (weeklyMeal.error) throw weeklyMeal.error;
  assert(Number(weeklyMeal.data.total_calories) === 500, "Computed weekly-plan-meal calories were not enforced.");
  const hiddenWeeklyMeal = await second.client.from("weekly_plan_meals").select("id").eq("weekly_plan_id", weeklyPlan.data.id);
  if (hiddenWeeklyMeal.error) throw hiddenWeeklyMeal.error;
  assert(hiddenWeeklyMeal.data.length === 0, "User B could read User A's weekly plan meals.");
  const crossUserWeeklyMeal = await second.client.from("weekly_plan_meals").insert({
    weekly_plan_id: weeklyPlan.data.id,
    day_of_week: 1,
    day_name: "Monday",
    slot_index: 1,
    meal_slot: "Lunch",
    title: "Cross-user meal",
    calories_per_serving: 400,
  });
  assert(crossUserWeeklyMeal.error, "User B inserted a weekly plan meal into User A's plan.");

  const customFood = await first.client.from("custom_foods").insert({ user_id: first.id, food_name: "Private sauce", default_weight_g: 20, calories_per_g: 2, label_calories: 40, label_weight_g: 20 }).select("id").single();
  if (customFood.error) throw customFood.error;
  const hiddenFood = await second.client.from("custom_foods").select("id").eq("id", customFood.data.id);
  if (hiddenFood.error) throw hiddenFood.error;
  assert(hiddenFood.data.length === 0, "User B could read User A's custom food.");

  const log = await first.client.from("food_logs").insert({ user_id: first.id, log_date: "2026-09-06", food_name: "Eggs", weight_g: 100, calories_per_g: 1.43, calories: 0 }).select("calories").single();
  if (log.error) throw log.error;
  assert(Number(log.data.calories) === 143, "Computed food-log calories were not enforced.");

  console.log("RLS verification passed: private rows are isolated, badge ownership is enforced, public plans are readable, weekly plans and custom foods remain private, and computed totals are enforced.");
} finally {
  for (const user of [first, second]) {
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}
