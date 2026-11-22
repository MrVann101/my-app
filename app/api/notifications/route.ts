import { apiErrorResponse, ApiError } from "@/lib/api";
import { dateInTimezone } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

export type AppNotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  category: "reminder" | "streak" | "plan" | "milestone" | "community";
  tag: string;
};

function resolveTimezone(requested: string | null, profileTz?: string | null): string {
  for (const candidate of [requested, profileTz, "UTC"]) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
      return candidate;
    } catch {
      // Fall through to next candidate.
    }
  }
  return "UTC";
}

function formatBadgeTitle(badgeType: string): string {
  return badgeType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const url = new URL(request.url);
    const requestedTimezone = url.searchParams.get("timezone");

    const { data: profile } = await supabase
      .from("profiles")
      .select("target_calories, timezone, username")
      .eq("user_id", user.id)
      .maybeSingle();

    const timezone = resolveTimezone(requestedTimezone, profile?.timezone ?? null);
    const today = dateInTimezone(new Date(), timezone);

    const [logsRes, streakRes, weeklyPlansRes, badgesRes, prefsRes] = await Promise.all([
      supabase.from("food_logs").select("calories, meal_type").eq("user_id", user.id).eq("log_date", today),
      supabase.from("streaks").select("current_streak, last_log_date").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("weekly_plans")
        .select("id, name, is_active")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("badges")
        .select("badge_key, earned_at")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false })
        .limit(2),
      supabase
        .from("notification_preferences")
        .select("email_enabled, frequency, reminder_time, timezone")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const notifications: AppNotificationItem[] = [];
    const logs = logsRes.data ?? [];
    const targetCalories = typeof profile?.target_calories === "number" ? profile.target_calories : null;
    const caloriesConsumed = Math.round(
      logs.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0),
    );
    const currentStreak = Number(streakRes.data?.current_streak ?? 0);
    const loggedToday = logs.length > 0 || streakRes.data?.last_log_date === today;

    if (!targetCalories) {
      notifications.push({
        id: "onboarding-setup",
        title: "Complete your nutrition targets",
        body: "Set your daily calorie and macro goals so Bitewise can personalize your plans.",
        href: "/onboarding",
        category: "reminder",
        tag: "Setup",
      });
    } else if (logs.length === 0) {
      if (currentStreak > 0) {
        notifications.push({
          id: `streak-protect-${today}`,
          title: `Keep your ${currentStreak}-day streak going`,
          body: "Log a meal today to maintain your daily nutrition streak.",
          href: "/log",
          category: "streak",
          tag: "Today",
        });
      } else {
        notifications.push({
          id: `daily-log-reminder-${today}`,
          title: "Ready to log today's meals?",
          body: `Your daily goal is ${targetCalories.toLocaleString()} kcal. Add breakfast, lunch, or a saved meal in seconds.`,
          href: "/log",
          category: "reminder",
          tag: "Today",
        });
      }
    } else {
      const remaining = targetCalories - caloriesConsumed;
      notifications.push({
        id: `daily-progress-${today}-${logs.length}`,
        title:
          Math.abs(remaining) <= 150
            ? "Right on your daily target"
            : remaining > 0
              ? `${remaining.toLocaleString()} kcal remaining today`
              : "Daily meals logged",
        body: `You've logged ${caloriesConsumed.toLocaleString()} of ${targetCalories.toLocaleString()} kcal across ${logs.length} ${logs.length === 1 ? "entry" : "entries"} today.`,
        href: "/dashboard",
        category: "reminder",
        tag: "Today",
      });

      if (currentStreak >= 3 && loggedToday) {
        notifications.push({
          id: `streak-milestone-${currentStreak}`,
          title: `${currentStreak}-day logging streak`,
          body: "Steady consistency builds lasting habits. Check your trends in Progress.",
          href: "/profile/progress",
          category: "streak",
          tag: "Streak",
        });
      }
    }

    const weeklyPlans = weeklyPlansRes.data ?? [];
    const activeWeeklyPlan = weeklyPlans.find((plan) => plan.is_active) ?? weeklyPlans[0];
    if (!activeWeeklyPlan) {
      notifications.push({
        id: "weekly-plan-create-prompt",
        title: "Create your 7-day meal schedule",
        body: "Generate a personalized weekly meal plan with an automatic grocery checklist.",
        href: "/weekly-plan",
        category: "plan",
        tag: "Planner",
      });
    } else {
      notifications.push({
        id: `weekly-plan-active-${activeWeeklyPlan.id}`,
        title: `Active schedule: ${activeWeeklyPlan.name}`,
        body: "Open your 7-day meal schedule or check off items on its grocery list.",
        href: "/weekly-plan",
        category: "plan",
        tag: "Active",
      });
    }

    const latestBadge = (badgesRes.data ?? [])[0];
    if (latestBadge?.badge_key) {
      notifications.push({
        id: `badge-${latestBadge.badge_key}`,
        title: `Badge unlocked: ${formatBadgeTitle(latestBadge.badge_key)}`,
        body: "View your earned nutrition milestones on your dashboard.",
        href: "/dashboard",
        category: "milestone",
        tag: "Badge",
      });
    }

    notifications.push({
      id: "official-bitewise-public-plans-v1",
      title: "10 Official Bitewise Team Meal Plans",
      body: "Explore chef-crafted high-protein, Mediterranean, and Filipino-balanced recipes with full macros.",
      href: "/meal-plans?tab=public-plans",
      category: "community",
      tag: "New",
    });

    const prefs = prefsRes.data;
    const reminderSummary =
      prefs?.email_enabled && prefs.frequency !== "off"
        ? `${prefs.frequency === "weekly" ? "Weekly" : "Daily"} at ${String(prefs.reminder_time ?? "19:00").slice(0, 5)}`
        : "Off";

    return Response.json({
      notifications,
      reminderSummary,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
