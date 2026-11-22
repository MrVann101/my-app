import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { escapeIlike } from "@/lib/image-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(200).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  goal: z.enum(["lose", "maintain", "gain"]).optional(),
  dietType: z.string().trim().max(80).optional(),
  minCalories: z.coerce.number().finite().nonnegative().optional(),
  maxCalories: z.coerce.number().finite().nonnegative().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = querySchema.parse(params);
    if (query.minCalories !== undefined && query.maxCalories !== undefined && query.minCalories > query.maxCalories) {
      throw new ApiError(400, "Minimum calories must be below maximum calories.", "invalid_filter");
    }

    let requestQuery = supabase.from("meal_plans").select("*, meal_plan_items(*)", { count: "exact" }).eq("visibility", "public");
    if (query.goal) requestQuery = requestQuery.eq("goal", query.goal);
    if (query.dietType) requestQuery = requestQuery.ilike("diet_type", escapeIlike(query.dietType));
    if (query.minCalories !== undefined) requestQuery = requestQuery.gte("total_calories", query.minCalories);
    if (query.maxCalories !== undefined) requestQuery = requestQuery.lte("total_calories", query.maxCalories);

    const from = (query.page - 1) * query.limit;
    const { data: plans, count, error } = await requestQuery.order("created_at", { ascending: false }).range(from, from + query.limit - 1);
    if (error) throw new ApiError(400, "Unable to load public meal plans.", "public_plan_fetch_failed");

    const ownerIds = [...new Set((plans ?? []).map((plan) => plan.user_id))];
    const admin = createAdminClient();
    const { data: profiles, error: profileError } = ownerIds.length > 0
      ? await admin.from("profiles").select("user_id, username").in("user_id", ownerIds)
      : { data: [], error: null };
    if (profileError) throw new ApiError(400, "Unable to load plan creator profiles.", "public_plan_creator_fetch_failed");

    const usernames = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.username]));
    const publicPlans = (plans ?? []).map((plan) => ({
      ...plan,
      creator_username: usernames.get(plan.user_id) ?? "Bitewise member",
    }));

    return Response.json({ plans: publicPlans, page: query.page, limit: query.limit, total: count ?? 0 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
