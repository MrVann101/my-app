import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const context = { params: Promise.resolve({ id: "42" }) };

describe("fork meal plan route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only creates a private plan copy and never adds food to the calorie tracker", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 84, error: null });
    const from = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      rpc,
      from,
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans/42/fork", { method: "POST" }), context);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ planId: 84 });
    expect(rpc).toHaveBeenCalledWith("fork_public_meal_plan", { p_source_id: 42, p_user_id: "user-1" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated fork requests", async () => {
    const rpc = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      rpc,
    } as never);

    const response = await POST(new Request("http://localhost/api/meal-plans/42/fork", { method: "POST" }), context);

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
