import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { weeklyPlanSaveSchema } from "@/lib/weekly-plan-schemas";
import { createClient } from "@/lib/supabase/server";

const planFields = "id,name,preferences,days,created_at,updated_at";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const { data: plans, error } = await supabase
      .from("weekly_plans")
      .select(planFields)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw new ApiError(500, "Unable to load saved weekly plans.", "weekly_plans_load_failed");
    return Response.json({ plans });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const body = await parseJson(request, weeklyPlanSaveSchema);

    const { data: plan, error } = await supabase
      .from("weekly_plans")
      .insert({
        user_id: user.id,
        name: body.name,
        preferences: body.preferences,
        days: body.days,
      })
      .select(planFields)
      .single();
    if (error) throw new ApiError(500, "Unable to save this weekly plan.", "weekly_plan_save_failed");
    return Response.json({ plan }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
