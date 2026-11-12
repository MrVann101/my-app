import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("saved meal deletion route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes only the authenticated user's meal plan", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 15 }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const ownerFilter = vi.fn(() => ({ select }));
    const idFilter = vi.fn(() => ({ eq: ownerFilter }));
    const deletePlan = vi.fn(() => ({ eq: idFilter }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ delete: deletePlan })),
    } as never);

    const response = await DELETE(new Request("http://localhost/api/meal-plans/15", { method: "DELETE" }), {
      params: Promise.resolve({ id: "15" }),
    });

    expect(response.status).toBe(200);
    expect(deletePlan).toHaveBeenCalledOnce();
    expect(idFilter).toHaveBeenCalledWith("id", 15);
    expect(ownerFilter).toHaveBeenCalledWith("user_id", "user-1");
    expect(select).toHaveBeenCalledWith("id");
    expect((await response.json()).deleted).toBe(true);
  });

  it("returns not found when the plan does not belong to the user", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const ownerFilter = vi.fn(() => ({ select }));
    const idFilter = vi.fn(() => ({ eq: ownerFilter }));
    const deletePlan = vi.fn(() => ({ eq: idFilter }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ delete: deletePlan })),
    } as never);

    const response = await DELETE(new Request("http://localhost/api/meal-plans/15", { method: "DELETE" }), {
      params: Promise.resolve({ id: "15" }),
    });

    expect(response.status).toBe(404);
    expect(deletePlan).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated deletion", async () => {
    const from = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    } as never);

    const response = await DELETE(new Request("http://localhost/api/meal-plans/15", { method: "DELETE" }), {
      params: Promise.resolve({ id: "15" }),
    });

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("saved meal favorite route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates favorite state only on the authenticated user's meal plan", async () => {
    const savedPlan = { id: 15, is_favorite: true, favorited_at: "2026-10-23T00:00:00.000Z" };
    const single = vi.fn().mockResolvedValue({ data: savedPlan, error: null });
    const select = vi.fn(() => ({ single }));
    const ownerFilter = vi.fn(() => ({ select }));
    const idFilter = vi.fn(() => ({ eq: ownerFilter }));
    const update = vi.fn(() => ({ eq: idFilter }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(new Request("http://localhost/api/meal-plans/15", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: true }),
    }), { params: Promise.resolve({ id: "15" }) });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      is_favorite: true,
      favorited_at: expect.any(String),
    }));
    expect(idFilter).toHaveBeenCalledWith("id", 15);
    expect(ownerFilter).toHaveBeenCalledWith("user_id", "user-1");
    expect((await response.json()).plan.is_favorite).toBe(true);
  });
});
