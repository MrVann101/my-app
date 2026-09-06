import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("photo analysis route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the daily cap response before analyzing when no slot is available", async () => {
    const profileQuery = {
      select: vi.fn(() => profileQuery),
      eq: vi.fn(() => profileQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { timezone: "UTC" }, error: null }),
    };
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    mockedCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) }, from: vi.fn(() => profileQuery), rpc } as never);

    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://localhost/api/food/analyze-photo", { method: "POST", body: form }));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("daily_photo_cap");
    expect(rpc).toHaveBeenCalledWith("claim_ai_photo_slot", expect.objectContaining({ p_user_id: "user-1" }));
  });
});
