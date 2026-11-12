import { apiErrorResponse, ApiError, idSchema, parseJson } from "@/lib/api";
import { weeklyPlanUpdateSchema } from "@/lib/weekly-plan-schemas";
import { createClient } from "@/lib/supabase/server";

const planFields = "id,name,preferences,days,created_at,updated_at";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    const body = await parseJson(request, weeklyPlanUpdateSchema);

    const { data: plan, error } = await supabase
      .from("weekly_plans")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(planFields)
      .maybeSingle();
    if (error) throw new ApiError(500, "Unable to update this weekly plan.", "weekly_plan_update_failed");
    if (!plan) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");
    return Response.json({ plan });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);

    const { data: plan, error } = await supabase
      .from("weekly_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new ApiError(500, "Unable to delete this weekly plan.", "weekly_plan_delete_failed");
    if (!plan) throw new ApiError(404, "Weekly plan not found.", "weekly_plan_not_found");
    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
