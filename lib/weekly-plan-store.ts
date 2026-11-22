import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import {
  hydrateWeeklyPlanRecord,
  serializeWeeklyPlanMeals,
  type WeeklyPlan,
  type WeeklyPlanGroceryState,
  type WeeklyPlanSchedule,
  type WeeklyPlanPreferences,
} from "@/lib/weekly-plan-schemas";

const legacyPlanFields = "id,name,preferences,days,created_at,updated_at";
const normalizedPlanFields =
  "id,name,preferences,days,daily_calorie_target,meals_per_day,preferred_foods,food_restrictions,is_active,avg_daily_calories,avg_daily_protein_g,avg_daily_carbs_g,avg_daily_fat_g,created_at,updated_at";
const mealSelectFields =
  "id,weekly_plan_id,day_of_week,day_name,slot_index,meal_slot,title,description,servings,calories_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving";
const normalizedPlanFieldsWithGrocery = `${normalizedPlanFields},grocery_state`;
const normalizedPlanWithMealsFields = `${normalizedPlanFields},weekly_plan_meals(${mealSelectFields})`;
const normalizedPlanWithMealsAndGroceryFields = `${normalizedPlanFieldsWithGrocery},weekly_plan_meals(${mealSelectFields})`;

type DbErrorLike = { code?: string; message?: string } | null;

export type CreateWeeklyPlanInput = {
  name: string;
  preferences: WeeklyPlanPreferences;
  days: WeeklyPlanSchedule;
  isActive?: boolean;
  groceryState?: WeeklyPlanGroceryState;
};

export type UpdateWeeklyPlanInput = Partial<CreateWeeklyPlanInput>;

function isMissingGroceryStateColumnError(error: DbErrorLike): boolean {
  if (!error) return false;
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    (error.message ?? "").includes("grocery_state")
  );
}

function isMissingNormalizedSchemaError(error: DbErrorLike): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST200") {
    return true;
  }
  if (error.code === "PGRST205" || error.code === "42P01") {
    return (error.message ?? "").includes("weekly_plan_meals");
  }
  return false;
}

function weeklyPlanDatabaseError(error: DbErrorLike, operation: "load" | "save" | "update" | "delete") {
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    return new ApiError(
      503,
      "Weekly plans are not available until Supabase migration 0021_weekly_plans.sql is applied.",
      "weekly_plans_schema_unavailable",
    );
  }
  const messages = {
    load: ["Unable to load saved weekly plans.", "weekly_plans_load_failed"],
    save: ["Unable to save this weekly plan.", "weekly_plan_save_failed"],
    update: ["Unable to update this weekly plan.", "weekly_plan_update_failed"],
    delete: ["Unable to delete this weekly plan.", "weekly_plan_delete_failed"],
  } as const;
  const [message, code] = messages[operation];
  return new ApiError(500, message, code);
}

function sortPlansActiveFirst(plans: WeeklyPlan[]): WeeklyPlan[] {
  return [...plans].sort((a, b) => Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)));
}

async function clearOtherActivePlans(supabase: SupabaseClient, userId: string, exceptPlanId?: number) {
  const table = supabase.from("weekly_plans");
  if (typeof table.update !== "function") return true;

  let query = table
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (exceptPlanId !== undefined && typeof query.neq === "function") {
    query = query.neq("id", exceptPlanId);
  }

  const { error } = await query;
  if (error) {
    if (isMissingNormalizedSchemaError(error)) return false;
    throw weeklyPlanDatabaseError(error, "save");
  }
  return true;
}

export async function listWeeklyPlans(supabase: SupabaseClient, userId: string): Promise<WeeklyPlan[]> {
  const withGrocery = await supabase
    .from("weekly_plans")
    .select(normalizedPlanWithMealsAndGroceryFields)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!withGrocery.error) {
    return sortPlansActiveFirst((withGrocery.data ?? []).map((row) => hydrateWeeklyPlanRecord(row)));
  }

  if (isMissingGroceryStateColumnError(withGrocery.error)) {
    const normalized = await supabase
      .from("weekly_plans")
      .select(normalizedPlanWithMealsFields)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (!normalized.error) {
      return sortPlansActiveFirst((normalized.data ?? []).map((row) => hydrateWeeklyPlanRecord(row)));
    }
    if (!isMissingNormalizedSchemaError(normalized.error)) {
      throw weeklyPlanDatabaseError(normalized.error, "load");
    }
  } else if (!isMissingNormalizedSchemaError(withGrocery.error)) {
    throw weeklyPlanDatabaseError(withGrocery.error, "load");
  }

  const legacy = await supabase
    .from("weekly_plans")
    .select(legacyPlanFields)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (legacy.error) throw weeklyPlanDatabaseError(legacy.error, "load");
  return (legacy.data ?? []).map((row) => hydrateWeeklyPlanRecord(row));
}

export async function createWeeklyPlan(
  supabase: SupabaseClient,
  userId: string,
  body: CreateWeeklyPlanInput,
): Promise<WeeklyPlan> {
  const shouldActivate = body.isActive !== false;
  let supportsNormalized = true;

  if (shouldActivate) {
    supportsNormalized = await clearOtherActivePlans(supabase, userId);
  }

  if (supportsNormalized) {
    const normalizedPayload: Record<string, unknown> = {
      user_id: userId,
      name: body.name,
      preferences: body.preferences,
      days: body.days,
      daily_calorie_target: body.preferences.dailyCalorieTarget,
      meals_per_day: body.preferences.mealsPerDay,
      preferred_foods: body.preferences.preferredFoods,
      food_restrictions: body.preferences.foodRestrictions,
      is_active: shouldActivate,
      ...(body.groceryState !== undefined ? { grocery_state: body.groceryState } : {}),
    };

    let insertResult = await supabase
      .from("weekly_plans")
      .insert(normalizedPayload)
      .select(normalizedPlanFieldsWithGrocery)
      .single();

    if (insertResult.error && isMissingGroceryStateColumnError(insertResult.error)) {
      const retryPayload = { ...normalizedPayload };
      delete retryPayload.grocery_state;
      insertResult = await supabase
        .from("weekly_plans")
        .insert(retryPayload)
        .select(normalizedPlanFields)
        .single();
    }

    const { data: plan, error } = insertResult;

    if (!error && plan) {
      const mealRows = serializeWeeklyPlanMeals(plan.id, body.days);
      const mealsTable = supabase.from("weekly_plan_meals");
      let insertedMeals: unknown[] | undefined;

      if (typeof mealsTable.insert === "function") {
        const mealInsert = await mealsTable
          .insert(mealRows)
          .select(mealSelectFields);

        if (mealInsert && typeof mealInsert === "object" && "error" in mealInsert && mealInsert.error) {
          const mealError = mealInsert.error as DbErrorLike;
          if (!isMissingNormalizedSchemaError(mealError)) {
            if (typeof supabase.from("weekly_plans").delete === "function") {
              await supabase.from("weekly_plans").delete().eq("id", plan.id).eq("user_id", userId);
            }
            throw weeklyPlanDatabaseError(mealError, "save");
          }
        } else if (mealInsert && typeof mealInsert === "object" && "data" in mealInsert && Array.isArray(mealInsert.data)) {
          insertedMeals = mealInsert.data;
        }
      }

      return hydrateWeeklyPlanRecord({
        ...plan,
        ...(insertedMeals ? { weekly_plan_meals: insertedMeals } : {}),
      });
    }

    if (!isMissingNormalizedSchemaError(error)) {
      throw weeklyPlanDatabaseError(error, "save");
    }
  }

  const legacy = await supabase
    .from("weekly_plans")
    .insert({
      user_id: userId,
      name: body.name,
      preferences: body.preferences,
      days: body.days,
    })
    .select(legacyPlanFields)
    .single();

  if (legacy.error || !legacy.data) throw weeklyPlanDatabaseError(legacy.error, "save");
  return hydrateWeeklyPlanRecord(legacy.data);
}

export async function updateWeeklyPlan(
  supabase: SupabaseClient,
  userId: string,
  id: number,
  body: UpdateWeeklyPlanInput,
): Promise<WeeklyPlan> {
  let supportsNormalized = true;

  if (body.isActive === true) {
    supportsNormalized = await clearOtherActivePlans(supabase, userId, id);
  }

  if (supportsNormalized) {
    const selectFields = body.days ? normalizedPlanFields : normalizedPlanWithMealsFields;
    const selectFieldsWithGrocery = body.days ? normalizedPlanFieldsWithGrocery : normalizedPlanWithMealsAndGroceryFields;

    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.preferences !== undefined) {
      updatePayload.preferences = body.preferences;
      updatePayload.daily_calorie_target = body.preferences.dailyCalorieTarget;
      updatePayload.meals_per_day = body.preferences.mealsPerDay;
      updatePayload.preferred_foods = body.preferences.preferredFoods;
      updatePayload.food_restrictions = body.preferences.foodRestrictions;
    }
    if (body.days !== undefined) updatePayload.days = body.days;
    if (body.isActive !== undefined) updatePayload.is_active = body.isActive;
    if (body.groceryState !== undefined) updatePayload.grocery_state = body.groceryState;

    const initialUpdate = await supabase
      .from("weekly_plans")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select(selectFieldsWithGrocery)
      .maybeSingle();

    let plan: unknown = initialUpdate.data;
    let error: DbErrorLike = initialUpdate.error;

    if (error && isMissingGroceryStateColumnError(error)) {
      const retryPayload = { ...updatePayload };
      delete retryPayload.grocery_state;
      if (Object.keys(retryPayload).length > 0) {
        const retryResult = await supabase
          .from("weekly_plans")
          .update(retryPayload)
          .eq("id", id)
          .eq("user_id", userId)
          .select(selectFields)
          .maybeSingle();
        plan = retryResult.data;
        error = retryResult.error;
      } else {
        const existingNormalized = await supabase
          .from("weekly_plans")
          .select(normalizedPlanWithMealsFields)
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingNormalized.error) {
          if (!existingNormalized.data) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");
          return hydrateWeeklyPlanRecord(existingNormalized.data);
        }
        if (!isMissingNormalizedSchemaError(existingNormalized.error)) {
          throw weeklyPlanDatabaseError(existingNormalized.error, "update");
        }
        plan = null;
        error = existingNormalized.error;
      }
    }

    if (!error) {
      if (!plan) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");

      if (body.days) {
        const { error: deleteMealsError } = await supabase
          .from("weekly_plan_meals")
          .delete()
          .eq("weekly_plan_id", id);

        if (deleteMealsError && !isMissingNormalizedSchemaError(deleteMealsError)) {
          throw weeklyPlanDatabaseError(deleteMealsError, "update");
        }

        if (!deleteMealsError) {
          const mealRows = serializeWeeklyPlanMeals(id, body.days);
          const { data: insertedMeals, error: insertMealsError } = await supabase
            .from("weekly_plan_meals")
            .insert(mealRows)
            .select(mealSelectFields);

          if (insertMealsError && !isMissingNormalizedSchemaError(insertMealsError)) {
            throw weeklyPlanDatabaseError(insertMealsError, "update");
          }

          if (!insertMealsError && Array.isArray(insertedMeals)) {
            return hydrateWeeklyPlanRecord({
              ...(plan as unknown as Record<string, unknown>),
              weekly_plan_meals: insertedMeals,
            });
          }
        }
      }

      return hydrateWeeklyPlanRecord(plan);
    }

    if (!isMissingNormalizedSchemaError(error)) {
      throw weeklyPlanDatabaseError(error, "update");
    }
  }

  const legacyUpdate: Record<string, unknown> = {};
  if (body.name !== undefined) legacyUpdate.name = body.name;
  if (body.preferences !== undefined) legacyUpdate.preferences = body.preferences;
  if (body.days !== undefined) legacyUpdate.days = body.days;

  if (Object.keys(legacyUpdate).length === 0) {
    const existing = await supabase
      .from("weekly_plans")
      .select(legacyPlanFields)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw weeklyPlanDatabaseError(existing.error, "update");
    if (!existing.data) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");
    return hydrateWeeklyPlanRecord(existing.data);
  }

  const legacy = await supabase
    .from("weekly_plans")
    .update(legacyUpdate)
    .eq("id", id)
    .eq("user_id", userId)
    .select(legacyPlanFields)
    .maybeSingle();

  if (legacy.error) throw weeklyPlanDatabaseError(legacy.error, "update");
  if (!legacy.data) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");
  return hydrateWeeklyPlanRecord(legacy.data);
}

export async function deleteWeeklyPlan(
  supabase: SupabaseClient,
  userId: string,
  id: number,
): Promise<{ deleted: true }> {
  const { data: plan, error } = await supabase
    .from("weekly_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw weeklyPlanDatabaseError(error, "delete");
  if (!plan) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");
  return { deleted: true };
}
