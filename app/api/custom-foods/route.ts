import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { data: foods, error } = await supabase.from("custom_foods").select("id, food_name, default_weight_g, calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g").eq("user_id", user.id).order("food_name");
    if (error) throw new ApiError(400, error.message, "custom_food_fetch_failed");
    return Response.json({ foods: foods ?? [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const createSchema = z.object({
  foodName: z.string().trim().min(1).max(200),
  defaultWeightG: z.number().finite().positive().max(100_000),
  nutrientRate: z.object({
    caloriesPerG: z.number().finite().nonnegative(),
    proteinPerG: z.number().finite().nonnegative(),
    carbsPerG: z.number().finite().nonnegative(),
    fatPerG: z.number().finite().nonnegative(),
    fiberPerG: z.number().finite().nonnegative(),
    sodiumPerG: z.number().finite().nonnegative(),
    sugarPerG: z.number().finite().nonnegative(),
  }),
  labelCalories: z.number().finite().nonnegative(),
  labelWeightG: z.number().finite().positive(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = createSchema.parse(await request.json());
    const { data: food, error } = await supabase.from("custom_foods").insert({ user_id: user.id, food_name: body.foodName, default_weight_g: body.defaultWeightG, calories_per_g: body.nutrientRate.caloriesPerG, protein_per_g: body.nutrientRate.proteinPerG, carbs_per_g: body.nutrientRate.carbsPerG, fat_per_g: body.nutrientRate.fatPerG, fiber_per_g: body.nutrientRate.fiberPerG, sodium_per_g: body.nutrientRate.sodiumPerG, sugar_per_g: body.nutrientRate.sugarPerG, label_calories: body.labelCalories, label_weight_g: body.labelWeightG }).select().single();
    if (error) throw new ApiError(400, error.message, "custom_food_save_failed");
    return Response.json({ food }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
