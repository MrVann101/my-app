import { apiErrorResponse, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
export async function POST(_request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Meal plan id is invalid.", "invalid_id");
    const { data: forkedId, error } = await supabase.rpc("fork_public_meal_plan", { p_source_id: id, p_user_id: user.id });
    if (error) throw new ApiError(400, error.message, "meal_plan_fork_failed");
    return Response.json({ planId: forkedId }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
