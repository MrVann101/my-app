import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { searchFoods } from "@/lib/food-search";
import { claimRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.string().trim().min(2).max(100);

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    await claimRateLimit({
      key: `food_search:${user.id}`,
      windowSeconds: 60,
      limit: 40,
      message: "You are searching very quickly. Please pause a few seconds and try again.",
    });

    const query = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
    if (!query.success) throw new ApiError(400, "Search must be between 2 and 100 characters.", "invalid_query");

    const result = await searchFoods(query.data);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
