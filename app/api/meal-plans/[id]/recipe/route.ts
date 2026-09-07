import { apiErrorResponse, ApiError } from "@/lib/api";
import { buildPlanRecipe } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Meal plan id is invalid.", "invalid_id");
    const { data: plan, error } = await supabase.from("meal_plans").select("name, user_id, visibility, meal_plan_items(food_name, weight_g)").eq("id", id).maybeSingle();
    if (error) throw new ApiError(400, error.message, "meal_plan_fetch_failed");
    if (!plan || (plan.user_id !== user.id && plan.visibility !== "public")) throw new ApiError(404, "Meal plan not found.", "meal_plan_not_found");
    if (!plan.meal_plan_items?.length) throw new ApiError(400, "This meal plan has no ingredients.", "empty_meal_plan");
    return Response.json({ recipe: buildPlanRecipe(plan.name, plan.meal_plan_items) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
