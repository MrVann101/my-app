import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { WEEK_DAYS, serializeWeeklyPlanMeals } from "@/lib/weekly-plan-schemas";

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

  it("hydrates normalized rows sorted with active plan first", async () => {
    const activeRows = serializeWeeklyPlanMeals(2, schedule);
    const query = { eq: vi.fn(), order: vi.fn() };
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Older Inactive",
          preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
          days: schedule,
          is_active: false,
          created_at: "2026-11-20T00:00:00Z",
          updated_at: "2026-11-20T00:00:00Z",
        },
        {
          id: 2,
          name: "Active Plan",
          daily_calorie_target: 2000,
          meals_per_day: 3,
          preferred_foods: ["oats"],
          food_restrictions: [],
          is_active: true,
          days: schedule,
          weekly_plan_meals: activeRows,
          created_at: "2026-11-19T00:00:00Z",
          updated_at: "2026-11-19T00:00:00Z",
        },
      ],
      error: null,
    });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    } as never);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.plans[0].id).toBe(2);
    expect(json.plans[0].isActive).toBe(true);
    expect(json.plans[0].summary.avgDailyCalories).toBe(1750);
  });

  it("falls back to legacy 0021 columns on GET when 0022 migration is not applied", async () => {
    const queryNormalized = { eq: vi.fn(), order: vi.fn() };
    queryNormalized.eq.mockReturnValue(queryNormalized);
    queryNormalized.order.mockResolvedValue({
      data: null,
      error: { code: "PGRST200", message: "Could not find a relationship between 'weekly_plans' and 'weekly_plan_meals'" },
    });

    const queryLegacy = { eq: vi.fn(), order: vi.fn() };
    queryLegacy.eq.mockReturnValue(queryLegacy);
    queryLegacy.order.mockResolvedValue({
      data: [{
        id: 5,
        name: "Legacy Week",
        preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
        days: schedule,
        created_at: "2026-11-18T00:00:00Z",
        updated_at: "2026-11-18T00:00:00Z",
      }],
      error: null,
    });

    const select = vi
      .fn()
      .mockImplementationOnce(() => queryNormalized)
      .mockImplementationOnce(() => queryLegacy);

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.plans).toHaveLength(1);
    expect(json.plans[0].id).toBe(5);
    expect(json.plans[0].summary.totalMeals).toBe(21);
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

  it("reports when the weekly plans migration is missing", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST205", message: "table missing" } });
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
        preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
        days: schedule,
      }),
    }));

    expect(response.status).toBe(503);
    expect((await response.json()).error.message).toContain("0021_weekly_plans.sql");
  });

  it("saves groceryState on POST and falls back gracefully on GET when 0023 grocery_state column is missing", async () => {
    const queryWithGrocery = { eq: vi.fn(), order: vi.fn() };
    queryWithGrocery.eq.mockReturnValue(queryWithGrocery);
    queryWithGrocery.order.mockResolvedValue({
      data: null,
      error: { code: "42703", message: "column weekly_plans.grocery_state does not exist" },
    });

    const query0022 = { eq: vi.fn(), order: vi.fn() };
    query0022.eq.mockReturnValue(query0022);
    query0022.order.mockResolvedValue({
      data: [
        {
          id: 9,
          name: "Week Without 0023",
          preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
          days: schedule,
          is_active: true,
          created_at: "2026-11-21T00:00:00Z",
          updated_at: "2026-11-21T00:00:00Z",
        },
      ],
      error: null,
    });

    const selectGet = vi
      .fn()
      .mockImplementationOnce(() => queryWithGrocery)
      .mockImplementationOnce(() => query0022);

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select: selectGet })),
    } as never);

    const getRes = await GET();
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getJson.plans[0].id).toBe(9);
    expect(getJson.plans[0].groceryState).toBeUndefined();

    const savedPlan = {
      id: 10,
      name: "Plan With List",
      preferences: { dailyCalorieTarget: 2000, mealsPerDay: 3, preferredFoods: [], foodRestrictions: [] },
      days: schedule,
      grocery_state: { checked: ["oats"], custom: ["Olive oil"] },
    };
    const single = vi.fn().mockResolvedValue({ data: savedPlan, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ insert })),
    } as never);

    const postRes = await POST(
      new Request("http://localhost/api/weekly-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Plan With List",
          preferences: savedPlan.preferences,
          days: schedule,
          groceryState: { checked: ["oats"], custom: ["Olive oil"] },
        }),
      }),
    );
    const postJson = await postRes.json();

    expect(postRes.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        grocery_state: { checked: ["oats"], custom: ["Olive oil"] },
      }),
    );
    expect(postJson.plan.groceryState).toEqual({ checked: ["oats"], custom: ["Olive oil"] });
  });
});
