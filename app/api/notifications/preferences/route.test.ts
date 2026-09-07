import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const user = { id: "test-user" };

describe("notification preferences route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated reads", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    expect((await GET()).status).toBe(401);
  });

  it("rejects invalid timezones before writing", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } } as never);
    const response = await PUT(new Request("http://localhost/api/notifications/preferences", { method: "PUT", body: JSON.stringify({ emailEnabled: true, frequency: "daily", reminderTime: "19:00", timezone: "Not/AZone" }) }));
    expect(response.status).toBe(400);
  });
});
