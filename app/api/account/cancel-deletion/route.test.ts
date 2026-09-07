import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("cancel deletion route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated cancellation", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    expect((await POST()).status).toBe(401);
  });

  it("rejects a request outside the grace window", async () => {
    const query = { single: vi.fn().mockResolvedValue({ data: { deletion_requested_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() }, error: null }) };
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) }, from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(query) }) }) } as never);
    expect((await POST()).status).toBe(400);
  });
});
