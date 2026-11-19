import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { weeklyPlanSaveSchema } from "@/lib/weekly-plan-schemas";
import { createClient } from "@/lib/supabase/server";

const planFields = "id,name,preferences,days,created_at,updated_at";

function weeklyPlanDatabaseError(error: { code?: string } | null, operation: "load" | "save") {
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    return new ApiError(
      503,
      "Weekly plans are not available until Supabase migration 0021_weekly_plans.sql is applied.",
      "weekly_plans_schema_unavailable",
    );
  }
  return new ApiError(
    500,
    operation === "load" ? "Unable to load saved weekly plans." : "Unable to save this weekly plan.",
    operation === "load" ? "weekly_plans_load_failed" : "weekly_plan_save_failed",
  );
}

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
    if (error) throw weeklyPlanDatabaseError(error, "load");
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
    if (error) throw weeklyPlanDatabaseError(error, "save");
    return Response.json({ plan }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
