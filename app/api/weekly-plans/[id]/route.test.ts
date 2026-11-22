import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";
import { createClient } from "@/lib/supabase/server";
import { WEEK_DAYS } from "@/lib/weekly-plan-schemas";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const schedule = WEEK_DAYS.map((day) => ({
  day,
  meals: [
    {
      title: `${day} breakfast`,
      description: "Oats and fruit.",
      nutrition: { calories: 400, proteinG: 20, carbsG: 55, fatG: 10 },
      servings: 1,
    },
    {
      title: `${day} dinner`,
      description: "Salmon and greens.",
      nutrition: { calories: 700, proteinG: 45, carbsG: 40, fatG: 28 },
      servings: 1,
    },
  ],
}));

describe("weekly plan detail route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("activates a plan and clears other active plans for the user", async () => {
    const clearEq2 = vi.fn(() => ({ neq: vi.fn().mockResolvedValue({ error: null }) }));
    const clearEq1 = vi.fn(() => ({ eq: clearEq2 }));

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 7,
        name: "Cutting Week",
        preferences: { dailyCalorieTarget: 1800, mealsPerDay: 2, preferredFoods: [], foodRestrictions: [] },
        days: schedule,
        is_active: true,
        created_at: "2026-11-21T00:00:00Z",
        updated_at: "2026-11-21T01:00:00Z",
      },
      error: null,
    });
    const updateSelect = vi.fn(() => ({ maybeSingle }));
    const updateEq2 = vi.fn(() => ({ select: updateSelect }));
    const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));

    const update = vi
      .fn()
      .mockImplementationOnce(() => ({ eq: clearEq1 }))
      .mockImplementationOnce(() => ({ eq: updateEq1 }));

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/weekly-plans/7", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.plan.id).toBe(7);
    expect(json.plan.isActive).toBe(true);
    expect(update).toHaveBeenNthCalledWith(1, { is_active: false });
    expect(update).toHaveBeenNthCalledWith(2, { is_active: true });
  });

  it("deletes an owned weekly plan", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 7 }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const eq2 = vi.fn(() => ({ select }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: eq1 })) })),
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/weekly-plans/7", { method: "DELETE" }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
  });

  it("updates groceryState via PATCH and falls back cleanly when grocery_state column is missing", async () => {
    const maybeSingleWithGrocery = vi.fn().mockResolvedValue({
      data: {
        id: 7,
        name: "Cutting Week",
        preferences: { dailyCalorieTarget: 1800, mealsPerDay: 2, preferredFoods: [], foodRestrictions: [] },
        days: schedule,
        is_active: true,
        grocery_state: { checked: ["spinach"], custom: ["Olive oil"] },
        created_at: "2026-11-21T00:00:00Z",
        updated_at: "2026-11-21T01:00:00Z",
      },
      error: null,
    });
    const updateSelect = vi.fn(() => ({ maybeSingle: maybeSingleWithGrocery }));
    const updateEq2 = vi.fn(() => ({ select: updateSelect }));
    const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
    const update = vi.fn(() => ({ eq: updateEq1 }));

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ update })),
    } as never);

    const okRes = await PATCH(
      new Request("http://localhost/api/weekly-plans/7", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groceryState: { checked: ["spinach"], custom: ["Olive oil"] } }),
      }),
      { params: Promise.resolve({ id: "7" }) },
    );
    const okJson = await okRes.json();

    expect(okRes.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      grocery_state: { checked: ["spinach"], custom: ["Olive oil"] },
    });
    expect(okJson.plan.groceryState).toEqual({ checked: ["spinach"], custom: ["Olive oil"] });

    // Simulate 0022 database without 0023 grocery_state column
    const missingColMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'grocery_state' column of 'weekly_plans'" },
    });
    const missingUpdateSelect = vi.fn(() => ({ maybeSingle: missingColMaybeSingle }));
    const missingUpdateEq2 = vi.fn(() => ({ select: missingUpdateSelect }));
    const missingUpdateEq1 = vi.fn(() => ({ eq: missingUpdateEq2 }));
    const missingUpdate = vi.fn(() => ({ eq: missingUpdateEq1 }));

    const fallbackMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 7,
        name: "Cutting Week",
        preferences: { dailyCalorieTarget: 1800, mealsPerDay: 2, preferredFoods: [], foodRestrictions: [] },
        days: schedule,
        is_active: true,
        created_at: "2026-11-21T00:00:00Z",
        updated_at: "2026-11-21T01:00:00Z",
      },
      error: null,
    });
    const fallbackEq2 = vi.fn(() => ({ maybeSingle: fallbackMaybeSingle }));
    const fallbackEq1 = vi.fn(() => ({ eq: fallbackEq2 }));
    const fallbackSelect = vi.fn(() => ({ eq: fallbackEq1 }));

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ update: missingUpdate, select: fallbackSelect })),
    } as never);

    const fallbackRes = await PATCH(
      new Request("http://localhost/api/weekly-plans/7", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groceryState: { checked: ["spinach"], custom: [] } }),
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(fallbackRes.status).toBe(200);
    expect((await fallbackRes.json()).plan.id).toBe(7);
  });
});
