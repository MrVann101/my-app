import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { computeNutrients } from "@/lib/food";
import { mealPlanInputSchema } from "@/lib/meal-plan-schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const body = await parseJson(request, mealPlanInputSchema);
    if (!body.recipe && (!body.name || !body.items?.length)) {
      throw new ApiError(400, "Provide a generated recipe or a named plan with food items.", "invalid_meal_plan");
    }

    let validForkSourceId: number | null = null;
    if (body.forkedFrom) {
      const { data: visibleSource } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("id", body.forkedFrom)
        .eq("visibility", "public")
        .maybeSingle();
      if (!visibleSource) {
        throw new ApiError(404, "Source public meal plan was not found.", "source_plan_not_found");
      }
      validForkSourceId = body.forkedFrom;
    }

    const items = body.items ?? [];
    const totalCalories =
      body.recipe?.nutrition.calories ??
      items.reduce((sum, item) => sum + computeNutrients(item.weightG, item.nutrientRate).calories, 0);

    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        user_id: user.id,
        name: body.recipe?.title ?? body.name,
        visibility: body.visibility,
        goal: body.goal,
        diet_type: body.dietType,
        total_calories: totalCalories,
        recipe: body.recipe ?? null,
        cook_time_minutes: body.recipe?.cookTimeMinutes ?? null,
        nutrition: body.recipe?.nutrition ?? null,
        ...(validForkSourceId ? { forked_from: validForkSourceId } : {}),
      })
      .select()
      .single();

    if (planError) throw new ApiError(400, "Unable to save meal plan.", "meal_plan_save_failed");

    if (validForkSourceId) {
      try {
        const admin = createAdminClient();
        const { data: sourcePlan } = await admin
          .from("meal_plans")
          .select("save_count")
          .eq("id", validForkSourceId)
          .eq("visibility", "public")
          .maybeSingle();
        if (sourcePlan) {
          await admin
            .from("meal_plans")
            .update({ save_count: Number(sourcePlan.save_count ?? 0) + 1 })
            .eq("id", validForkSourceId);
        }
      } catch {
        // Non-blocking save counter increment
      }
    }

    if (items.length > 0) {
      const rows = items.map((item) => {
        const totals = computeNutrients(item.weightG, item.nutrientRate);
        return {
          plan_id: plan.id,
          meal_type: item.mealType,
          food_name: item.foodName,
          weight_g: item.weightG,
          calories_per_g: item.nutrientRate.caloriesPerG,
          protein_per_g: item.nutrientRate.proteinPerG,
          carbs_per_g: item.nutrientRate.carbsPerG,
          fat_per_g: item.nutrientRate.fatPerG,
          fiber_per_g: item.nutrientRate.fiberPerG,
          sodium_per_g: item.nutrientRate.sodiumPerG,
          sugar_per_g: item.nutrientRate.sugarPerG,
          calories: totals.calories,
          protein_g: totals.proteinG,
          carbs_g: totals.carbsG,
          fat_g: totals.fatG,
          fiber_g: totals.fiberG,
          sodium_mg: totals.sodiumMg,
          sugar_g: totals.sugarG,
        };
      });
      const { data: savedItems, error: itemError } = await supabase.from("meal_plan_items").insert(rows).select();
      if (itemError) {
        await supabase.from("meal_plans").delete().eq("id", plan.id);
        throw new ApiError(400, "Unable to save meal plan items.", "meal_plan_items_save_failed");
      }
      return Response.json({ plan: { ...plan, meal_plan_items: savedItems } }, { status: 201 });
    }

    return Response.json({ plan: { ...plan, meal_plan_items: [] } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const { data: plans, error } = await supabase
      .from("meal_plans")
      .select("*, meal_plan_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new ApiError(400, "Unable to load meal plans.", "meal_plan_fetch_failed");
    return Response.json({ plans });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
