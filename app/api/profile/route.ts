import { apiErrorResponse, ApiError } from "@/lib/api";
import { calculateTargets, normalizeOnboardingInput } from "@/lib/calculations";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const body = await request.formData();
    const input = normalizeOnboardingInput(Object.fromEntries(body.entries()));
    const targets = calculateTargets(input);
    const username = String(user.user_metadata.username ?? "").trim();
    if (!username) throw new ApiError(400, "Your account is missing a username.", "missing_username");

    const { data, error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      username,
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      age: input.age,
      sex: input.sex,
      activity_level: input.activityLevel,
      goal: input.goal,
      timezone: input.timezone,
      bmr: targets.bmr,
      tdee: targets.tdee,
      target_calories: targets.targetCalories,
      target_protein_g: targets.targetProteinG,
      target_carbs_g: targets.targetCarbsG,
      target_fat_g: targets.targetFatG,
    }, { onConflict: "user_id" }).select().single();

    if (error) throw new ApiError(400, error.message, "profile_save_failed");
    return Response.json({ profile: data, targets });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw new ApiError(400, error.message, "profile_fetch_failed");
    return Response.json({ profile: data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
