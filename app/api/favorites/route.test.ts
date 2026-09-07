import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("favorites route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated reads", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    expect((await GET()).status).toBe(401);
  });

  it("rejects unauthenticated writes before parsing input", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    const response = await POST(new Request("http://localhost/api/favorites", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });
});
