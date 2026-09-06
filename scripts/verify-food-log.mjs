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
  // Hosted environments provide process environment variables directly.
}

const baseUrl = process.env.BITEWISE_TEST_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required.");

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const credentials = { email: `food_log_${suffix}@example.com`, password: "BitewiseFoodLogTest123!" };
let userId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers);
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const payload = await response.json();
  return { response, payload, cookie: response.headers.getSetCookie?.().map((value) => value.split(";")[0]).join("; ") ?? cookie };
}

try {
  const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true, user_metadata: { username: `food_log_${suffix.slice(-12)}` } });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const profile = await admin.from("profiles").insert({ user_id: userId, username: `food_log_${suffix.slice(-12)}`, weight_kg: 70, height_cm: 175, age: 30, sex: "female", activity_level: "moderate", goal: "maintain", timezone: "UTC", target_calories: 2000, target_protein_g: 150, target_carbs_g: 200, target_fat_g: 67 });
  if (profile.error) throw profile.error;

  const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
  assert(login.response.ok, `Login failed: ${login.response.status}`);
  const cookie = login.cookie;
  assert(cookie, "Login did not return a session cookie.");

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const logged = await request("/api/food/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logDate: today, mealType: "lunch", foodName: "Integration rice", weightG: 150, nutrientRate: { caloriesPerG: 1.3, proteinPerG: 0.02, carbsPerG: 0.28, fatPerG: 0, fiberPerG: 0, sodiumPerG: 0, sugarPerG: 0 }, source: "database", dataSource: "usda", aiConfidence: null }),
  }, cookie);
  assert(logged.response.status === 201, `Food log failed: ${logged.response.status}`);
  assert(Number(logged.payload.log.calories) === 195, "Food log total was not computed from weight and rate.");

  const logs = await request(`/api/food/log?date=${today}`, {}, cookie);
  assert(logs.response.ok && logs.payload.logs.some((log) => log.food_name === "Integration rice"), "Saved food log was not returned.");

  const dashboard = await request("/api/dashboard", {}, cookie);
  assert(dashboard.response.ok, `Dashboard failed: ${dashboard.response.status}`);
  assert(Number(dashboard.payload.caloriesConsumed) === 195, "Dashboard did not include the saved food log.");
  assert(Number(dashboard.payload.streak.current_streak) === 1, "Streak was not updated for the first daily log.");

  const summary = await admin.from("daily_summaries").select("total_calories, logged_at_least_once").eq("user_id", userId).eq("summary_date", today).single();
  if (summary.error) throw summary.error;
  assert(Number(summary.data.total_calories) === 195 && summary.data.logged_at_least_once, "Daily summary was not refreshed.");

  console.log("Food-log integration verification passed: authenticated route, computed totals, retrieval, summary, streak, and dashboard are connected.");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
