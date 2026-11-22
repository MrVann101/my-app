import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateClient = vi.mocked(createClient);

function request(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("login route (username + password)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitMemoryForTests();
  });

  it("signs in directly with username + password for username-only accounts", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockedCreateClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as never);

    const response = await POST(request({ username: "Mark_24", password: "StrongPass123!" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ userId: "user-1" });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "mark_24@users.bitewise.local",
      password: "StrongPass123!",
    });
  });

  it("rejects wildcard characters in non-email login identifiers", async () => {
    const signInWithPassword = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as never);

    const response = await POST(request({ username: "%admin%", password: "StrongPass123!" }));
    expect(response.status).toBe(401);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("falls back to escaped profile lookup for legacy email-backed accounts like alex_demo", async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: { message: "Invalid login credentials" } })
      .mockResolvedValueOnce({ data: { user: { id: "legacy-user-1" } }, error: null });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: "legacy-user-1" },
      error: null,
    });
    const ilike = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ ilike }));
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { id: "legacy-user-1", email: "alex@realmail.com" } },
      error: null,
    });

    mockedCreateClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as never);
    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
      auth: { admin: { getUserById } },
    } as never);

    const response = await POST(request({ username: "alex_demo", password: "StrongPass123!" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ userId: "legacy-user-1" });
    expect(ilike).toHaveBeenCalledWith("username", "alex\\_demo");
    expect(signInWithPassword).toHaveBeenNthCalledWith(2, {
      email: "alex@realmail.com",
      password: "StrongPass123!",
    });
  });

  it("returns 401 with username or password message when credentials are invalid", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const ilike = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ ilike }));

    mockedCreateClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as never);
    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
      auth: { admin: { getUserById: vi.fn() } },
    } as never);

    const response = await POST(request({ username: "unknown_user", password: "wrong" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.message).toBe("Username or password is incorrect.");
  });
});
