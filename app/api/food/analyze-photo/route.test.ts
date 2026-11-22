import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { AiFoodError, analyzeFoodImage, validateFoodImage } from "@/lib/ai-food";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/ai-food", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-food")>();
  return { ...actual, analyzeFoodImage: vi.fn(), validateFoodImage: vi.fn() };
});

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedAnalyzeFoodImage = vi.mocked(analyzeFoodImage);
const mockedValidateFoodImage = vi.mocked(validateFoodImage);

function setupAuthenticatedClient(adminRpc: ReturnType<typeof vi.fn>) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: { timezone: "UTC" }, error: null }),
  };
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn(() => profileQuery),
  } as never);
  mockedCreateAdminClient.mockReturnValue({ rpc: adminRpc } as never);
  return adminRpc;
}

describe("photo analysis route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the daily cap response before analyzing when no slot is available", async () => {
    const rpc = setupAuthenticatedClient(vi.fn().mockResolvedValue({ data: false, error: null }));
    mockedValidateFoodImage.mockResolvedValue({ base64: "encoded-image", mimeType: "image/jpeg" });

    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://localhost/api/food/analyze-photo", { method: "POST", body: form }));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("daily_photo_cap");
    expect(rpc).toHaveBeenCalledWith("claim_ai_photo_slot", expect.objectContaining({ p_user_id: "user-1" }));
  });

  it("rejects unsupported image input before claiming personal or global AI quota slots", async () => {
    const rpc = setupAuthenticatedClient(vi.fn());
    mockedValidateFoodImage.mockRejectedValue(new AiFoodError("Unsupported image type. Use JPEG, PNG, or WebP."));

    const form = new FormData();
    form.set("image", new File(["not an image"], "meal.gif", { type: "image/gif" }));
    const response = await POST(new Request("http://localhost/api/food/analyze-photo", { method: "POST", body: form }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("invalid_food_image");
    expect(payload.error.message).toContain("Unsupported image type");
    expect(rpc).not.toHaveBeenCalled();
    expect(mockedAnalyzeFoodImage).not.toHaveBeenCalled();
  });

  it("returns a retryable service error and releases slot when both AI providers are unavailable", async () => {
    const rpc = setupAuthenticatedClient(vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValue({ data: null, error: null }));
    mockedValidateFoodImage.mockResolvedValue({ base64: "encoded-image", mimeType: "image/jpeg" });
    mockedAnalyzeFoodImage.mockRejectedValue(new AiFoodError(
      "Food image analysis is unavailable. Search the food database or enter it manually.",
      true,
    ));

    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://localhost/api/food/analyze-photo", { method: "POST", body: form }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("photo_analysis_unavailable");
    expect(payload.error.message).toContain("Food image analysis is unavailable");
    expect(rpc).toHaveBeenCalledWith("release_ai_photo_slot", expect.objectContaining({ p_user_id: "user-1" }));
  });
});
