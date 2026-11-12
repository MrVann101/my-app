import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { WEEK_DAYS } from "@/lib/weekly-plan-schemas";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const schedule = WEEK_DAYS.map((day) => ({
  day,
  meals: [{
    title: `${day} breakfast`,
    description: "A balanced breakfast.",
    nutrition: { calories: 450, proteinG: 25, carbsG: 45, fatG: 14 },
    servings: 1,
  }, {
    title: `${day} lunch`,
    description: "A balanced lunch.",
    nutrition: { calories: 600, proteinG: 35, carbsG: 60, fatG: 18 },
    servings: 1,
  }, {
    title: `${day} dinner`,
    description: "A balanced dinner.",
    nutrition: { calories: 700, proteinG: 40, carbsG: 70, fatG: 20 },
    servings: 1,
  }],
}));

describe("weekly plans route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads plans scoped to the authenticated user", async () => {
    const query = { eq: vi.fn(), order: vi.fn() };
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect((await response.json()).plans).toEqual([]);
  });

  it("saves a validated plan for its owner", async () => {
    const plan = { id: 8, name: "My Week", preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] }, days: schedule };
    const single = vi.fn().mockResolvedValue({ data: plan, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(new Request("http://localhost/api/weekly-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Week",
        preferences: plan.preferences,
        days: schedule,
      }),
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      name: "My Week",
      days: schedule,
    }));
    expect((await response.json()).plan.id).toBe(8);
  });
});
