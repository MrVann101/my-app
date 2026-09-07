import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { nutrientRateSchema } from "@/lib/food";
import { createClient } from "@/lib/supabase/server";

const favoriteSchema = z.object({ foodName: z.string().trim().min(1).max(200), defaultWeightG: z.number().finite().positive().max(100_000), nutrientRate: nutrientRateSchema });

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await currentUser();
    const { data: favorites, error } = await supabase.from("favorite_foods").select("*").eq("user_id", user.id).order("use_count", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new ApiError(400, error.message, "favorite_fetch_failed");
    return Response.json({ favorites: favorites ?? [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await currentUser();
    const body = await parseJson(request, favoriteSchema);
    const values = { user_id: user.id, food_name: body.foodName, default_weight_g: body.defaultWeightG, calories_per_g: body.nutrientRate.caloriesPerG, protein_per_g: body.nutrientRate.proteinPerG, carbs_per_g: body.nutrientRate.carbsPerG, fat_per_g: body.nutrientRate.fatPerG, fiber_per_g: body.nutrientRate.fiberPerG, sodium_per_g: body.nutrientRate.sodiumPerG, sugar_per_g: body.nutrientRate.sugarPerG };
    const { data: existing, error: lookupError } = await supabase.from("favorite_foods").select("id").eq("user_id", user.id).eq("food_name", body.foodName).maybeSingle();
    if (lookupError) throw new ApiError(400, lookupError.message, "favorite_fetch_failed");
    const query = existing ? supabase.from("favorite_foods").update(values).eq("id", existing.id).eq("user_id", user.id) : supabase.from("favorite_foods").insert(values);
    const { data: favorite, error } = await query.select().single();
    if (error) throw new ApiError(400, error.message, "favorite_save_failed");
    return Response.json({ favorite }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
