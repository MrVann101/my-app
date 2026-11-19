import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { foodLogInputSchema, foodLogRequestSchema } from "@/lib/food-log-schemas";

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

  it("accepts a batch of food logs for one save-all request", () => {
    expect(foodLogRequestSchema.parse([validInput, { ...validInput, foodName: "Beans" }])).toHaveLength(2);
    expect(() => foodLogRequestSchema.parse([])).toThrow();
  });

  it("inserts all food logs from a batch in one database call", async () => {
    const insertedLogs = [{ id: "log-1" }, { id: "log-2" }];
    const foodLogResults = [
      { data: insertedLogs, error: null },
      { data: [{ calories: 195, protein_g: 3, carbs_g: 42, fat_g: 0, fiber_g: 0, sodium_mg: 0, sugar_g: 0 }], error: null },
      { count: 0, error: null },
    ];
    const insertedPayloads: unknown[] = [];
    const makeQuery = (result: unknown) => {
      const query: Record<string, unknown> = {};
      query.insert = vi.fn((payload: unknown) => {
        insertedPayloads.push(payload);
        return query;
      });
      for (const method of ["select", "eq", "upsert"]) {
        query[method] = vi.fn(() => query);
      }
      query.maybeSingle = vi.fn().mockResolvedValue(result);
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return query;
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "food_logs") return makeQuery(foodLogResults.shift());
        if (table === "exercise_logs") return makeQuery({ data: [], error: null });
        if (table === "profiles") return makeQuery({ data: { target_calories: 2000, timezone: "UTC" }, error: null });
        if (table === "daily_summaries") return makeQuery({ error: null });
        if (table === "streaks") return makeQuery({ data: null, error: null });
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockedCreateClient.mockResolvedValue(client as never);

    const response = await POST(new Request("http://localhost/api/food/log", {
      method: "POST",
      body: JSON.stringify([validInput, { ...validInput, foodName: "Beans" }]),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ logs: insertedLogs });
    expect(insertedPayloads).toHaveLength(1);
    expect(insertedPayloads[0]).toHaveLength(2);
  });

  it("marks a recipe log as one serving", () => {
    expect(foodLogInputSchema.parse({ ...validInput, isRecipe: true }).isRecipe).toBe(true);
    expect(foodLogInputSchema.parse(validInput).isRecipe).toBe(false);
  });

  it("accepts AI suggestions without a supported AI provider source", () => {
    expect(foodLogInputSchema.parse({
      ...validInput,
      source: "ai_text",
      dataSource: null,
    }).dataSource).toBeNull();
  });

  it("returns success when badge awarding fails after saving the food log", async () => {
    const insertedLog = { id: "log-1" };
    const foodLogResults = [
      { data: insertedLog, error: null },
      { data: [{ calories: 195, protein_g: 3, carbs_g: 42, fat_g: 0, fiber_g: 0, sodium_mg: 0, sugar_g: 0 }], error: null },
      { count: 1, error: null },
    ];
    const makeQuery = (result: unknown) => {
      const query: Record<string, unknown> = {};
      for (const method of ["insert", "select", "eq", "upsert"]) {
        query[method] = vi.fn(() => query);
      }
      query.single = vi.fn().mockResolvedValue(result);
      query.maybeSingle = vi.fn().mockResolvedValue(result);
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return query;
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "food_logs") return makeQuery(foodLogResults.shift());
        if (table === "exercise_logs") return makeQuery({ data: [], error: null });
        if (table === "profiles") return makeQuery({ data: { target_calories: 2000, timezone: "UTC" }, error: null });
        if (table === "daily_summaries") return makeQuery({ error: null });
        if (table === "streaks") return makeQuery({ data: null, error: null });
        if (table === "badges") return makeQuery({ error: { message: 'new row violates row-level security policy for table "badges"' } });
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockedCreateClient.mockResolvedValue(client as never);
    const loggerError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(new Request("http://localhost/api/food/log", {
      method: "POST",
      body: JSON.stringify(validInput),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ log: insertedLog });
    expect(loggerError).toHaveBeenCalledOnce();
    loggerError.mockRestore();
  });
});
