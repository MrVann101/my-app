import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const user = { id: "user-123" };

function buildSupabaseMock(overrides: {
  profile?: Record<string, unknown> | null;
  logs?: Array<{ calories: number; meal_type: string }>;
  streak?: { current_streak: number; last_log_date: string | null } | null;
  weeklyPlans?: Array<{ id: number; name: string; is_active: boolean }>;
  badges?: Array<{ badge_key: string; earned_at: string }>;
  preferences?: { email_enabled: boolean; frequency: string; reminder_time: string; timezone: string } | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: overrides.profile ?? { target_calories: 2000, timezone: "UTC", username: "alex_demo" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "food_logs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: overrides.logs ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "streaks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: overrides.streak ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "weekly_plans") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: overrides.weeklyPlans ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "badges") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: overrides.badges ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "notification_preferences") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: overrides.preferences ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests with 401", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);

    const response = await GET(new Request("http://localhost/api/notifications"));
    expect(response.status).toBe(401);
  });

  it("returns streak protection, daily log, and weekly plan notifications when no meals logged today", async () => {
    mockedCreateClient.mockResolvedValue(
      buildSupabaseMock({
        logs: [],
        streak: { current_streak: 4, last_log_date: "2026-11-21" },
        weeklyPlans: [],
      }) as never,
    );

    const response = await GET(new Request("http://localhost/api/notifications?timezone=UTC"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Array.isArray(payload.notifications)).toBe(true);
    expect(payload.notifications.some((n: { category: string }) => n.category === "streak")).toBe(true);
    expect(payload.notifications.some((n: { href: string }) => n.href === "/weekly-plan")).toBe(true);
    expect(payload.notifications.some((n: { href: string }) => n.href === "/meal-plans?tab=public-plans")).toBe(true);
  });

  it("returns daily calorie progress notification when meals are logged today", async () => {
    mockedCreateClient.mockResolvedValue(
      buildSupabaseMock({
        logs: [
          { calories: 520, meal_type: "breakfast" },
          { calories: 640, meal_type: "lunch" },
        ],
        streak: { current_streak: 5, last_log_date: "2026-11-22" },
        weeklyPlans: [{ id: 12, name: "High Protein Week", is_active: true }],
      }) as never,
    );

    const response = await GET(new Request("http://localhost/api/notifications?timezone=UTC"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    const progressItem = payload.notifications.find((n: { id: string }) => n.id.startsWith("daily-progress-"));
    expect(progressItem).toBeDefined();
    expect(progressItem.body).toContain("1,160");
  });
});
