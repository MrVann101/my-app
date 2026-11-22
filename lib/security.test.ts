import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveIsAdmin } from "@/lib/admin-auth";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendDeletionConfirmation } from "@/lib/email";
import { getResendApiKey, getServerEnv, getSupabaseAdminEnv } from "@/lib/env";
import {
  detectImageMimeFromBytes,
  escapeIlike,
  isSafeFoodPhotoUrl,
  isSafeMealPlanImageUrl,
} from "@/lib/image-security";

describe("admin authorization hardening (CRIT-01)", () => {
  it("never grants admin from client-writable user_metadata", () => {
    const user = {
      id: "00000000-0000-0000-0000-000000000001",
      app_metadata: {},
      user_metadata: { is_admin: true, username: "admin" },
    } as never;

    expect(resolveIsAdmin({ user, profileRow: { is_admin: false, username: "admin" } })).toBe(false);
  });

  it("grants admin from server-controlled app_metadata.is_admin", () => {
    const user = {
      id: "00000000-0000-0000-0000-000000000002",
      app_metadata: { is_admin: true },
    };

    expect(resolveIsAdmin({ user, profileRow: { is_admin: false } })).toBe(true);
  });

  it("grants admin from protected profiles.is_admin or ADMIN_USER_IDS", () => {
    const user = {
      id: "00000000-0000-0000-0000-000000000003",
      app_metadata: {},
    };

    expect(resolveIsAdmin({ user, profileRow: { is_admin: true } })).toBe(true);
    expect(
      resolveIsAdmin({
        user,
        profileRow: { is_admin: false },
        adminUserIdsEnv: "00000000-0000-0000-0000-000000000003",
      }),
    ).toBe(true);
  });
});

describe("image magic-byte and URL allowlist hardening (MED-02, MED-04, HIGH-03)", () => {
  it("detects valid JPEG, PNG, and WebP headers and rejects disguised files", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

    expect(detectImageMimeFromBytes(jpeg)).toBe("image/jpeg");
    expect(detectImageMimeFromBytes(png)).toBe("image/png");
    expect(detectImageMimeFromBytes(webp)).toBe("image/webp");
    expect(detectImageMimeFromBytes(svg)).toBeNull();
  });

  it("restricts meal-plan imageUrl strictly to bundled /meals/* or Bitewise Supabase bucket", () => {
    const supabaseUrl = "https://proj123.supabase.co";
    expect(
      isSafeMealPlanImageUrl(
        "https://proj123.supabase.co/storage/v1/object/public/meal-plan-photos/u1/img.jpg",
        supabaseUrl,
      ),
    ).toBe(true);
    expect(isSafeMealPlanImageUrl("/meals/chicken-tinola.jpg", supabaseUrl)).toBe(true);

    expect(isSafeMealPlanImageUrl("https://attacker.supabase.co/storage/v1/object/public/meal-plan-photos/u1/img.jpg", supabaseUrl)).toBe(false);
    expect(isSafeMealPlanImageUrl("https://evil.example/pixel.png", supabaseUrl)).toBe(false);
    expect(isSafeMealPlanImageUrl("http://proj123.supabase.co/storage/v1/object/public/meal-plan-photos/u1/img.jpg", supabaseUrl)).toBe(false);
    expect(isSafeMealPlanImageUrl("data:image/svg+xml,<svg/>", supabaseUrl)).toBe(false);
    expect(isSafeMealPlanImageUrl("javascript:alert(1)", supabaseUrl)).toBe(false);
    expect(isSafeMealPlanImageUrl("https://proj123.supabase.co/storage/v1/object/public/meal-plan-photos/../other/x.jpg", supabaseUrl)).toBe(false);
  });

  it("restricts food photo URLs to the caller's own food-photos folder", () => {
    const supabaseUrl = "https://proj123.supabase.co";
    expect(
      isSafeFoodPhotoUrl(
        "https://proj123.supabase.co/storage/v1/object/public/food-photos/user-a/pic.jpg",
        "user-a",
        supabaseUrl,
      ),
    ).toBe(true);
    expect(
      isSafeFoodPhotoUrl(
        "https://proj123.supabase.co/storage/v1/object/public/food-photos/user-b/pic.jpg",
        "user-a",
        supabaseUrl,
      ),
    ).toBe(false);
    expect(
      isSafeFoodPhotoUrl(
        "https://proj123.supabase.co/storage/v1/object/public/food-photos/user-a/../user-b/pic.jpg",
        "user-a",
        supabaseUrl,
      ),
    ).toBe(false);
  });

  it("escapes PostgreSQL ILIKE wildcards", () => {
    expect(escapeIlike("alex_demo%100\\x")).toBe("alex\\_demo\\%100\\\\x");
  });
});

describe("constant-time cron authorization (LOW-02)", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("fails closed when CRON_SECRET is unset and authorizes matching bearer tokens", () => {
    const req = new Request("http://localhost/api/cron/purge-photos", {
      headers: { authorization: "Bearer super-secret-token" },
    });
    expect(isAuthorizedCronRequest(req)).toBe(false);

    process.env.CRON_SECRET = "super-secret-token";
    expect(isAuthorizedCronRequest(req)).toBe(true);

    const wrong = new Request("http://localhost/api/cron/purge-photos", {
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(isAuthorizedCronRequest(wrong)).toBe(false);
  });
});

describe("optional Resend configuration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("allows admin and server env loading and skips email delivery when RESEND_API_KEY is unset", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj123.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    process.env.USDA_API_KEY = "usda-key";
    delete process.env.RESEND_API_KEY;

    expect(getResendApiKey()).toBeNull();
    expect(getSupabaseAdminEnv()).toEqual({
      supabaseUrl: "https://proj123.supabase.co",
      supabaseServiceRoleKey: "service-key",
    });
    expect(getServerEnv().resendApiKey).toBeUndefined();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(sendDeletionConfirmation("user@example.com", "2026-12-01")).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
