import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { foodLogInputSchema } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const validInput = {
  logDate: "2026-09-07",
  mealType: "lunch",
  foodName: "Rice",
  weightG: 150,
  nutrientRate: { caloriesPerG: 1.3, proteinPerG: 0.02, carbsPerG: 0.28, fatPerG: 0, fiberPerG: 0, sodiumPerG: 0, sugarPerG: 0 },
  source: "database",
  dataSource: "usda",
  aiConfidence: null,
};

describe("food log route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated POST requests", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    const response = await POST(new Request("http://localhost/api/food/log", { method: "POST", body: JSON.stringify(validInput) }));
    expect(response.status).toBe(401);
  });

  it("accepts identical foods as separate entries", () => {
    const first = foodLogInputSchema.parse(validInput);
    const second = foodLogInputSchema.parse(validInput);
    expect(first.foodName).toBe(second.foodName);
    expect(first.weightG).toBe(second.weightG);
  });
});
