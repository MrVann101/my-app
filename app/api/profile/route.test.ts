import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const validFields = { weightKg: "80", heightCm: "180", age: "30", sex: "male", activityLevel: "moderate", goal: "lose", timezone: "America/New_York" };

function request(fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request("http://localhost/api/profile", { method: "POST", body: form });
}

describe("profile onboarding route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated onboarding", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    expect((await POST(request(validFields))).status).toBe(401);
  });

  it("persists calculated targets for valid onboarding data", async () => {
    const single = vi.fn().mockResolvedValue({ data: { user_id: "user-1", target_calories: 2000 }, error: null });
    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { username: "alex" } } } }) }, from: vi.fn().mockReturnValue({ upsert }) } as never);
    const response = await POST(request(validFields));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.targets.targetCalories).toBeGreaterThan(0);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("rejects invalid IANA timezones", async () => {
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { username: "alex" } } } }) } } as never);
    expect((await POST(request({ ...validFields, timezone: "Not/AZone" }))).status).toBe(400);
  });
});
