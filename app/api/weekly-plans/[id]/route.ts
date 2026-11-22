import { apiErrorResponse, ApiError, idSchema, parseJson } from "@/lib/api";
import { weeklyPlanUpdateSchema } from "@/lib/weekly-plan-schemas";
import { deleteWeeklyPlan, updateWeeklyPlan } from "@/lib/weekly-plan-store";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    const body = await parseJson(request, weeklyPlanUpdateSchema);

    const plan = await updateWeeklyPlan(supabase, user.id, id, body);
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

    const result = await deleteWeeklyPlan(supabase, user.id, id);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
