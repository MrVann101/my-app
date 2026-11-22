import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const VALID_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe("meal plan photo upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitMemoryForTests();
  });

  it("uploads a valid image verified by magic bytes scoped to the authenticated user", async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: "user-1/photo.jpg" }, error: null });
    const getPublicUrl = vi.fn(() => ({
      data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/meal-plan-photos/user-1/photo.jpg" },
    }));

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
    } as never);

    const formData = new FormData();
    formData.set("photo", new File([VALID_JPEG], "dish.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/meal-plans/upload-photo", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0][0]).toMatch(/^user-1\/.+\.jpg$/);
    expect(payload.imageUrl).toContain("meal-plan-photos/user-1/photo.jpg");
  });

  it("rejects disguised non-image files even when labeled image/jpeg", async () => {
    const upload = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      storage: { from: vi.fn(() => ({ upload })) },
    } as never);

    const formData = new FormData();
    formData.set("photo", new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "evil.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/meal-plans/upload-photo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("blocks deleting another user's uploaded photo path", async () => {
    const remove = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      storage: { from: vi.fn(() => ({ remove })) },
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/meal-plans/upload-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "user-2/11111111-1111-4111-8111-111111111111.jpg" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(remove).not.toHaveBeenCalled();
  });
});
