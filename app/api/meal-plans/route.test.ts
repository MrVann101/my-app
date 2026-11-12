import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("saved recipe route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only private plans for My Plans", async () => {
    const privatePlan = { id: 15, name: "Private chicken bowl", visibility: "private" };
    const query = { eq: vi.fn(), order: vi.fn() };
    query.eq.mockImplementation(() => query);
    query.order.mockResolvedValue({ data: [privatePlan], error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "visibility", "private");
    expect((await response.json()).plans).toEqual([privatePlan]);
  });

  it("saves a public recipe without applying a meal-plan calorie minimum", async () => {
    const savedPlan = { id: 14, name: "Chicken rice bowl", visibility: "public" };
    const single = vi.fn().mockResolvedValue({ data: savedPlan, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visibility: "public",
        recipe: {
          title: "Chicken rice bowl",
          description: "A simple meal.",
          cookTimeMinutes: 20,
          servings: 2,
          nutrition: { calories: 500, proteinG: 30, carbsG: 50, fatG: 12 },
          ingredients: [{ name: "Chicken", amount: "200 g", pantryStaple: false }],
          steps: ["Cook the chicken."],
        },
      }),
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: "Chicken rice bowl",
      visibility: "public",
      total_calories: 500,
      cook_time_minutes: 20,
    }));
    expect((await response.json()).plan.meal_plan_items).toEqual([]);
  });

  it("saves a private recipe for My Plans", async () => {
    const savedPlan = { id: 15, name: "Private chicken bowl", visibility: "private" };
    const single = vi.fn().mockResolvedValue({ data: savedPlan, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visibility: "private",
        recipe: {
          title: "Private chicken bowl",
          description: "A simple private meal.",
          cookTimeMinutes: 20,
          servings: 2,
          nutrition: { calories: 500, proteinG: 30, carbsG: 50, fatG: 12 },
          ingredients: [{ name: "Chicken", amount: "200 g", pantryStaple: false }],
          steps: ["Cook the chicken."],
        },
      }),
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: "Private chicken bowl",
      visibility: "private",
      recipe: expect.objectContaining({ title: "Private chicken bowl" }),
    }));
    expect((await response.json()).plan.visibility).toBe("private");
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("meal_plans");
  });

  it("saves a manually written recipe and its public photo URL", async () => {
    const savedPlan = { id: 16, name: "Vegetable soup", visibility: "public" };
    const single = vi.fn().mockResolvedValue({ data: savedPlan, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visibility: "public",
        recipe: {
          title: "Vegetable soup",
          description: "Manually added recipe.",
          cookTimeMinutes: 1,
          servings: 1,
          nutrition: { calories: 420, proteinG: 0, carbsG: 0, fatG: 0 },
          ingredients: [{ name: "Carrot", amount: "2", pantryStaple: false }],
          steps: ["Simmer the vegetables until tender."],
          manual: true,
          imageUrl: "https://example.supabase.co/storage/v1/object/public/meal-plan-photos/user-1/soup.jpg",
        },
      }),
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: "Vegetable soup",
      visibility: "public",
      total_calories: 420,
      recipe: expect.objectContaining({ manual: true, imageUrl: expect.stringContaining("soup.jpg") }),
    }));
  });

  it("rejects unauthenticated recipe saves", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);
    const response = await POST(new Request("http://localhost/api/meal-plans", {
      method: "POST",
      body: JSON.stringify({ recipe: {}, visibility: "private" }),
    }));
    expect(response.status).toBe(401);
  });
});
