import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { weeklyPlanSaveSchema } from "@/lib/weekly-plan-schemas";
import { createWeeklyPlan, listWeeklyPlans } from "@/lib/weekly-plan-store";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const plans = await listWeeklyPlans(supabase, user.id);
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

    const plan = await createWeeklyPlan(supabase, user.id, body);
    return Response.json({ plan }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
