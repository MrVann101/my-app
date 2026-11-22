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
  "0010_fork_meal_plan.sql",
  "0011_public_plan_deletion_visibility.sql",
  "0012_public_plan_profile_check.sql",
  "0013_recalibration.sql",
  "0014_notification_preferences.sql",
  "0015_badge_owner_insert.sql",
  "0016_saved_recipes.sql",
  "0017_repair_saved_recipe_columns.sql",
  "0018_favorite_meal_plans.sql",
  "0019_food_log_recipe_portions.sql",
  "0020_meal_plan_photos.sql",
  "0021_weekly_plans.sql",
  "0022_weekly_plans_normalized.sql",
  "0023_weekly_plan_grocery_state.sql",
  "0024_feedback_and_admin.sql",
  "0025_security_hardening.sql",
];
const sql = (await Promise.all(migrationNames.map((name) => readFile(join(root, name), "utf8")))).join("\n");

const tables = {
  profiles: ["user_id", "username", "weight_kg", "height_cm", "age", "sex", "activity_level", "goal", "timezone", "bmr", "tdee", "target_calories", "target_protein_g", "target_carbs_g", "target_fat_g", "deletion_requested_at", "is_admin", "updated_at"],
  food_logs: ["id", "user_id", "log_date", "meal_type", "food_name", "weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g", "source", "data_source", "ai_confidence", "logged_from_plan_id", "photo_url", "is_recipe", "created_at"],
  daily_summaries: ["user_id", "summary_date", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g", "total_fiber_g", "total_sodium_mg", "total_sugar_g", "calories_burned", "hit_target", "logged_at_least_once"],
  weight_logs: ["id", "user_id", "log_date", "weight_kg", "created_at"],
  exercise_logs: ["id", "user_id", "log_date", "activity_name", "calories_burned", "created_at"],
  streaks: ["user_id", "current_streak", "longest_streak", "last_log_date"],
  meal_plans: ["id", "user_id", "name", "visibility", "goal", "diet_type", "total_calories", "forked_from", "save_count", "created_at", "recipe", "cook_time_minutes", "nutrition", "is_favorite", "favorited_at"],
  meal_plan_items: ["id", "plan_id", "meal_type", "food_name", "weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g"],
  daily_ai_usage: ["user_id", "usage_date", "photo_count", "text_count"],
  favorite_foods: ["id", "user_id", "food_name", "default_weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "use_count", "created_at"],
  badges: ["id", "user_id", "badge_key", "earned_at"],
  custom_foods: ["id", "user_id", "food_name", "label_source", "default_weight_g", "calories_per_g", "protein_per_g", "carbs_per_g", "fat_per_g", "fiber_per_g", "sodium_per_g", "sugar_per_g", "label_calories", "label_weight_g", "created_at"],
  recalibration_states: ["user_id", "state", "recommended_calories", "updated_at"],
  notification_preferences: ["user_id", "email_enabled", "frequency", "reminder_time", "timezone", "updated_at"],
  weekly_plans: ["id", "user_id", "name", "preferences", "days", "daily_calorie_target", "meals_per_day", "preferred_foods", "food_restrictions", "is_active", "avg_daily_calories", "avg_daily_protein_g", "avg_daily_carbs_g", "avg_daily_fat_g", "grocery_state", "created_at", "updated_at"],
  weekly_plan_meals: ["id", "weekly_plan_id", "day_of_week", "day_name", "slot_index", "meal_slot", "title", "description", "servings", "calories_per_serving", "protein_g_per_serving", "carbs_g_per_serving", "fat_g_per_serving", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g", "created_at", "updated_at"],
  app_feedback: ["id", "user_id", "username_snapshot", "overall_rating", "focus_area", "logging_ease", "most_wanted", "message", "status", "admin_note", "reviewed_at", "created_at", "updated_at"],
  app_rate_limits: ["rate_key", "window_start", "request_count", "expires_at"],
};

for (const [table, columns] of Object.entries(tables)) {
  const tableMatch = sql.match(new RegExp(`create table (?:if not exists )?public\\.${table} \\([\\s\\S]*?^\\);`, "m"));
  if (!tableMatch) throw new Error(`Missing table: ${table}`);
  for (const column of columns) {
    const declaredInCreate = new RegExp(`^\\s+${column}\\s`, "m").test(tableMatch[0]);
    const declaredInAlter = new RegExp(`alter table public\\.${table}[\\s\\S]*?add column\\s+${column}\\b`, "i").test(sql);
    if (!declaredInCreate && !declaredInAlter) {
      throw new Error(`Missing column ${table}.${column}`);
    }
  }
}

for (const policy of [
  "Custom foods are private to their owner",
  "Badges can be earned by their owner",
  "Public meal plans are readable by authenticated users",
  "Meal plans are writable by their owner",
  "Public meal-plan items are readable by authenticated users",
  "Meal-plan items are writable by their plan owner",
  "Weekly plans are private to their owner",
  "Weekly plan meals are private to their plan owner",
  "App feedback is readable by its author",
  "App feedback is insertable by its author",
]) {
  if (!sql.includes(policy)) throw new Error(`Missing RLS policy: ${policy}`);
}

for (const trigger of ["food_logs_compute_totals", "meal_plan_items_compute_totals", "meal_plan_items_refresh_total", "weekly_plan_meals_compute_totals", "weekly_plan_meals_refresh_averages", "profiles_guard_sensitive_columns", "food_logs_lock_created_at", "meal_plans_guard_save_count"]) {
  if (!sql.includes(trigger)) throw new Error(`Missing integrity trigger: ${trigger}`);
}

for (const functionName of ["claim_ai_photo_slot", "release_ai_photo_slot", "claim_global_ai_rate_limit", "claim_ai_text_slot", "rollup_daily_summary", "fork_public_meal_plan", "is_profile_available_for_public_plan", "claim_rate_limit", "guard_profile_sensitive_columns"]) {
  if (!sql.includes(`function public.${functionName}`)) throw new Error(`Missing AI usage function: ${functionName}`);
}

console.log(`Schema coverage verified for ${Object.keys(tables).length} tables, required columns, RLS policies, and computed-total triggers.`);
