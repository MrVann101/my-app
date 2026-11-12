import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getMealSuggestions } from "@/lib/suggestions";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/suggestions", () => ({ getMealSuggestions: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetMealSuggestions = vi.mocked(getMealSuggestions);

function makeQuery(result: { data: unknown; error: null }) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("suggestions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMealSuggestions.mockResolvedValue({ suggestions: [], providerUsed: "fallback" });
  });

  it("includes exercise calories in the remaining suggestion budget", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "profiles") return makeQuery({ data: { timezone: "UTC", target_calories: 2000, target_protein_g: 120, target_carbs_g: 200, target_fat_g: 70 }, error: null });
        if (table === "food_logs") return makeQuery({ data: [{ calories: 1500, protein_g: 60, carbs_g: 100, fat_g: 30 }], error: null });
        if (table === "exercise_logs") return makeQuery({ data: [{ calories_burned: 200 }], error: null });
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockedCreateClient.mockResolvedValue(client as never);

    const response = await GET(new Request("http://localhost/api/suggestions?exclude=Old+meal&generation=2"));

    expect(response.status).toBe(200);
    expect(mockedGetMealSuggestions).toHaveBeenCalledWith({
      calories: 700,
      proteinG: 60,
      carbsG: 100,
      fatG: 40,
    }, ["Old meal"], 2);
    expect(await response.json()).toMatchObject({ remainingCalories: 700 });
  });
});
