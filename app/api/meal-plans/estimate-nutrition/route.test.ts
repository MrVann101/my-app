import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { estimateMealNutrition } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/recipes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recipes")>();
  return { ...actual, estimateMealNutrition: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedEstimateMealNutrition = vi.mocked(estimateMealNutrition);
const nutrition = { calories: 425, proteinG: 28, carbsG: 45, fatG: 12 };
const validInput = {
  name: "Chicken rice bowl",
  ingredients: [
    { name: "Chicken", amount: "200 g" },
    { name: "Rice", amount: "1 cup cooked" },
  ],
};

describe("meal plan nutrition estimate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as never);
  });

  it("returns an AI nutrition estimate for the provided meal ingredients", async () => {
    mockedEstimateMealNutrition.mockResolvedValue({ nutrition, isFallback: false });

    const response = await POST(new Request("http://localhost/api/meal-plans/estimate-nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInput),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ nutrition, isFallback: false });
    expect(mockedEstimateMealNutrition).toHaveBeenCalledWith(validInput.name, validInput.ingredients);
  });

  it("rejects unauthenticated requests", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans/estimate-nutrition", {
      method: "POST",
      body: JSON.stringify(validInput),
    }));

    expect(response.status).toBe(401);
    expect(mockedEstimateMealNutrition).not.toHaveBeenCalled();
  });

  it("rejects estimates when the shared AI rate limit is reached", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans/estimate-nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInput),
    }));

    expect(response.status).toBe(429);
    expect(mockedEstimateMealNutrition).not.toHaveBeenCalled();
  });

  it("reports AI provider failures instead of posting an unestimated meal", async () => {
    mockedEstimateMealNutrition.mockRejectedValue(new Error("Providers unavailable"));
    const loggerError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(new Request("http://localhost/api/meal-plans/estimate-nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInput),
    }));

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("meal_nutrition_estimation_failed");
    expect(loggerError).toHaveBeenCalledOnce();
    loggerError.mockRestore();
  });
});
