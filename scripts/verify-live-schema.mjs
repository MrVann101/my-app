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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required.");

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const expected = {
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
};

for (const [table, columns] of Object.entries(expected)) {
  const { error } = await admin.from(table).select(columns.join(",")).limit(0);
  if (error) throw new Error(`${table}: ${error.message}`);
}

console.log(`Live schema probe passed for ${Object.keys(expected).length} tables and required columns.`);