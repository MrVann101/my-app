import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("meal-plan logging route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated plan logging", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    const response = await POST(new Request("http://localhost/api/meal-plans/1/log", { method: "POST", body: JSON.stringify({ logDate: "2026-09-07" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(401);
  });

  it("rejects malformed plan ids after authentication", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) } } as never);
    const response = await POST(new Request("http://localhost/api/meal-plans/not-an-id/log", { method: "POST", body: JSON.stringify({ logDate: "2026-09-07" }) }), { params: Promise.resolve({ id: "not-an-id" }) });
    expect(response.status).toBe(400);
  });
});
