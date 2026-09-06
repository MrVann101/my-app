import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "supabase", "migrations");
const migrationNames = [
  "0001_profiles.sql",
  "0002_tracking.sql",
  "0003_meal_plans.sql",
  "0004_user_foods_and_usage.sql",
  "0005_computed_totals.sql",
  "0006_ai_usage_claim.sql",
  "0007_global_ai_rate_limit.sql",
  "0008_ai_text_usage_claim.sql",
  "0009_daily_summary_rollup.sql",
];
const sql = (await Promise.all(migrationNames.map((name) => readFile(join(root, name), "utf8")))).join("\n");

const tables = {
  profiles: ["user_id", "username", "weight_kg", "height_cm", "age", "sex", "activity_level", "goal", "timezone", "bmr", "tdee", "target_calories", "target_protein_g", "target_carbs_g", "target_fat_g", "deletion_requested_at", "updated_at"],
  food_logs: ["id", "user_id", "log_date", "meal_type", "food_name", "weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g", "source", "data_source", "ai_confidence", "logged_from_plan_id", "photo_url", "created_at"],
  daily_summaries: ["user_id", "summary_date", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g", "total_fiber_g", "total_sodium_mg", "total_sugar_g", "calories_burned", "hit_target", "logged_at_least_once"],
  weight_logs: ["id", "user_id", "log_date", "weight_kg", "created_at"],
  exercise_logs: ["id", "user_id", "log_date", "activity_name", "calories_burned", "created_at"],
  streaks: ["user_id", "current_streak", "longest_streak", "last_log_date"],
  meal_plans: ["id", "user_id", "name", "visibility", "goal", "diet_type", "total_calories", "forked_from", "save_count", "created_at"],
  meal_plan_items: ["id", "plan_id", "meal_type", "food_name", "weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g"],
  daily_ai_usage: ["user_id", "usage_date", "photo_count", "text_count"],
  favorite_foods: ["id", "user_id", "food_name", "default_weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "use_count", "created_at"],
  badges: ["id", "user_id", "badge_key", "earned_at"],
  custom_foods: ["id", "user_id", "food_name", "label_source", "default_weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "label_calories", "label_weight_g", "created_at"],
};

for (const [table, columns] of Object.entries(tables)) {
  const tableMatch = sql.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?^\\);`, "m"));
  if (!tableMatch) throw new Error(`Missing table: ${table}`);
  for (const column of columns) {
    if (!new RegExp(`^\\s+${column}\\s`, "m").test(tableMatch[0])) {
      throw new Error(`Missing column ${table}.${column}`);
    }
  }
}

for (const policy of [
  "Custom foods are private to their owner",
  "Public meal plans are readable by authenticated users",
  "Meal plans are writable by their owner",
  "Public meal-plan items are readable by authenticated users",
  "Meal-plan items are writable by their plan owner",
]) {
  if (!sql.includes(policy)) throw new Error(`Missing RLS policy: ${policy}`);
}

for (const trigger of ["food_logs_compute_totals", "meal_plan_items_compute_totals", "meal_plan_items_refresh_total"]) {
  if (!sql.includes(trigger)) throw new Error(`Missing integrity trigger: ${trigger}`);
}

for (const functionName of ["claim_ai_photo_slot", "release_ai_photo_slot", "claim_global_ai_rate_limit", "claim_ai_text_slot", "rollup_daily_summary"]) {
  if (!sql.includes(`function public.${functionName}`)) throw new Error(`Missing AI usage function: ${functionName}`);
}

console.log(`Schema coverage verified for ${Object.keys(tables).length} tables, required columns, RLS policies, and computed-total triggers.`);
