import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const dateSchema = z.object({ logDate: z.iso.date() });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const planId = Number((await context.params).id);
    if (!Number.isInteger(planId) || planId <= 0) throw new ApiError(400, "Meal plan id is invalid.", "invalid_id");
    const { logDate } = await parseJson(request, dateSchema);
    const { data: plan, error: planError } = await supabase.from("meal_plans").select("id, user_id, visibility, meal_plan_items(*)").eq("id", planId).maybeSingle();
    if (planError) throw new ApiError(400, planError.message, "meal_plan_fetch_failed");
    if (!plan || (plan.user_id !== user.id && plan.visibility !== "public")) throw new ApiError(404, "Meal plan not found.", "meal_plan_not_found");
    const items = (plan.meal_plan_items ?? []).map((item: Record<string, unknown>) => ({ user_id: user.id, log_date: logDate, meal_type: item.meal_type, food_name: item.food_name, weight_g: item.weight_g, calories_per_g: item.calories_per_g, protein_per_g: item.protein_per_g, carbs_per_g: item.carbs_per_g, fat_per_g: item.fat_per_g, fiber_per_g: item.fiber_per_g, sodium_per_g: item.sodium_per_g, sugar_per_g: item.sugar_per_g, calories: item.calories, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g, fiber_g: item.fiber_g, sodium_mg: item.sodium_mg, sugar_g: item.sugar_g, source: "database", data_source: null, ai_confidence: null, logged_from_plan_id: planId }));
    if (items.length === 0) throw new ApiError(400, "This meal plan has no items.", "empty_meal_plan");
    const { data: logs, error } = await supabase.from("food_logs").insert(items).select();
    if (error) throw new ApiError(400, error.message, "meal_plan_log_failed");
    return Response.json({ logs, logDate, planId }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
