import { requireAdmin } from "@/lib/admin-auth";
import { apiErrorResponse } from "@/lib/api";
import {
  FEEDBACK_FOCUS_AREAS,
  FEEDBACK_LOGGING_EASE,
  type FeedbackFocusArea,
  type FeedbackLoggingEase,
} from "@/lib/feedback-schemas";
import { listAllFeedbackForAdmin } from "@/lib/feedback-store";
import { isSafeMealPlanImageUrl } from "@/lib/image-security";

export const dynamic = "force-dynamic";

type RawPublicPlan = {
  id: string;
  user_id: string;
  name: string;
  visibility: string;
  goal: string | null;
  total_calories: number | null;
  save_count: number | null;
  created_at: string;
  recipe: Record<string, unknown> | null;
};

export async function GET() {
  try {
    const { admin, username } = await requireAdmin();

    const [feedback, usersCountRes, publicPlansRes] = await Promise.all([
      listAllFeedbackForAdmin(admin),
      admin.from("profiles").select("user_id", { count: "exact", head: true }),
      admin
        .from("meal_plans")
        .select("id, user_id, name, visibility, goal, total_calories, save_count, created_at, recipe")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const rawPlans = (publicPlansRes.data as RawPublicPlan[] | null) ?? [];
    const creatorIds = Array.from(new Set(rawPlans.map((p) => p.user_id)));

    const creatorMap = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: creators } = await admin
        .from("profiles")
        .select("user_id, username")
        .in("user_id", creatorIds);
      for (const row of (creators as Array<{ user_id: string; username: string }> | null) ?? []) {
        creatorMap.set(row.user_id, row.username);
      }
    }

    const publicPlans = rawPlans.map((plan) => {
      const candidatePhoto =
        plan.recipe && typeof plan.recipe.imageUrl === "string"
          ? plan.recipe.imageUrl
          : plan.recipe && typeof plan.recipe.photoUrl === "string"
            ? plan.recipe.photoUrl
            : null;
      const photoUrl = isSafeMealPlanImageUrl(candidatePhoto) ? candidatePhoto : null;
      return {
        id: plan.id,
        name: plan.name,
        creator: creatorMap.get(plan.user_id) ?? "Bitewise Member",
        goal: plan.goal,
        totalCalories: plan.total_calories ?? 0,
        saveCount: plan.save_count ?? 0,
        photoUrl,
        createdAt: plan.created_at,
      };
    });

    const areaCounts = Object.fromEntries(
      FEEDBACK_FOCUS_AREAS.map((area) => [area, 0]),
    ) as Record<FeedbackFocusArea, number>;

    const loggingEaseCounts = Object.fromEntries(
      FEEDBACK_LOGGING_EASE.map((ease) => [ease, 0]),
    ) as Record<FeedbackLoggingEase, number>;

    let ratingSum = 0;
    let openFeedback = 0;

    for (const item of feedback) {
      ratingSum += item.overallRating;
      if (item.status === "new" || item.status === "reviewing") {
        openFeedback += 1;
      }
      if (item.focusArea in areaCounts) {
        areaCounts[item.focusArea] += 1;
      }
      if (item.loggingEase in loggingEaseCounts) {
        loggingEaseCounts[item.loggingEase] += 1;
      }
    }

    let topFocusArea: FeedbackFocusArea | null = null;
    let maxCount = 0;
    for (const area of FEEDBACK_FOCUS_AREAS) {
      if (areaCounts[area] > maxCount) {
        maxCount = areaCounts[area];
        topFocusArea = area;
      }
    }

    const averageRating =
      feedback.length > 0
        ? Math.round((ratingSum / feedback.length) * 10) / 10
        : null;

    return Response.json({
      adminUsername: username,
      summary: {
        totalUsers: usersCountRes.count ?? 0,
        totalFeedback: feedback.length,
        openFeedback,
        averageRating,
        topFocusArea,
        areaCounts,
        loggingEaseCounts,
      },
      feedback,
      publicPlans,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
