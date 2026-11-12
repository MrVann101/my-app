import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { computeNutrients, foodWeightSchema, nutrientRateSchema } from "@/lib/food";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), visibility: z.enum(["private", "public"]).optional(), goal: z.enum(["lose", "maintain", "gain"]).nullable().optional(), dietType: z.string().trim().max(80).nullable().optional(), isFavorite: z.boolean().optional(), items: z.array(z.object({ mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"), foodName: z.string().trim().min(1).max(200), weightG: foodWeightSchema, nutrientRate: nutrientRateSchema })).min(1).max(50).optional() });
type Context = { params: Promise<{ id: string }> };
function planId(value: string) { const id = Number(value); if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Meal plan id is invalid.", "invalid_id"); return id; }

export async function GET(_request: Request, context: Context) { try { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized"); const id = planId((await context.params).id); const { data: plan, error } = await supabase.from("meal_plans").select("*, meal_plan_items(*)").eq("id", id).maybeSingle(); if (error) throw new ApiError(400, error.message, "meal_plan_fetch_failed"); if (!plan) throw new ApiError(404, "Meal plan not found.", "meal_plan_not_found"); return Response.json({ plan }); } catch (error) { return apiErrorResponse(error); } }

export async function PATCH(request: Request, context: Context) { try { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized"); const id = planId((await context.params).id); const body = await parseJson(request, updateSchema); const updates: Record<string, unknown> = {}; if (body.name !== undefined) updates.name = body.name; if (body.visibility !== undefined) updates.visibility = body.visibility; if (body.goal !== undefined) updates.goal = body.goal; if (body.dietType !== undefined) updates.diet_type = body.dietType; if (body.isFavorite !== undefined) { updates.is_favorite = body.isFavorite; updates.favorited_at = body.isFavorite ? new Date().toISOString() : null; } if (body.items) { await supabase.from("meal_plan_items").delete().eq("plan_id", id); const items = body.items.map((item) => { const totals = computeNutrients(item.weightG, item.nutrientRate); return { plan_id: id, meal_type: item.mealType, food_name: item.foodName, weight_g: item.weightG, calories_per_g: item.nutrientRate.caloriesPerG, protein_per_g: item.nutrientRate.proteinPerG, carbs_per_g: item.nutrientRate.carbsPerG, fat_per_g: item.nutrientRate.fatPerG, fiber_per_g: item.nutrientRate.fiberPerG, sodium_per_g: item.nutrientRate.sodiumPerG, sugar_per_g: item.nutrientRate.sugarPerG, calories: totals.calories, protein_g: totals.proteinG, carbs_g: totals.carbsG, fat_g: totals.fatG, fiber_g: totals.fiberG, sodium_mg: totals.sodiumMg, sugar_g: totals.sugarG }; }); const { error: itemError } = await supabase.from("meal_plan_items").insert(items); if (itemError) throw new ApiError(400, itemError.message, "meal_plan_items_save_failed"); } const { data: plan, error } = await supabase.from("meal_plans").update(updates).eq("id", id).eq("user_id", user.id).select("*, meal_plan_items(*)").single(); if (error) throw new ApiError(400, error.message, "meal_plan_update_failed"); return Response.json({ plan }); } catch (error) { return apiErrorResponse(error); } }

export async function DELETE(_request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const id = planId((await context.params).id);
    const { data: deletedPlan, error } = await supabase
      .from("meal_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new ApiError(400, error.message, "meal_plan_delete_failed");
    if (!deletedPlan) throw new ApiError(404, "Meal plan not found.", "meal_plan_not_found");

    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
