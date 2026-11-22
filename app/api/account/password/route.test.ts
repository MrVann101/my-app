import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { resetPasswordRateLimitForTests } from "@/lib/password-rate-limit";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateClient = vi.mocked(createClient);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/account/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordRateLimitForTests();
    resetRateLimitMemoryForTests();
  });

  it("rejects unauthenticated callers with 401", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const res = await POST(
      makeRequest({
        currentPassword: "oldpassword123",
        newPassword: "newpassword456",
        confirmPassword: "newpassword456",
      }),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("unauthorized");
  });

  it("rejects mismatched confirmation or identical new password with 400", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-1", email: "alex@users.bitewise.local", user_metadata: { username: "alex" } },
          },
        }),
      },
    } as never);

    const mismatchRes = await POST(
      makeRequest({
        currentPassword: "oldpassword123",
        newPassword: "newpassword456",
        confirmPassword: "differentpassword",
      }),
    );
    expect(mismatchRes.status).toBe(400);
    expect((await mismatchRes.json()).error.code).toBe("password_mismatch");

    const sameRes = await POST(
      makeRequest({
        currentPassword: "oldpassword123",
        newPassword: "oldpassword123",
        confirmPassword: "oldpassword123",
      }),
    );
    expect(sameRes.status).toBe(400);
    expect((await sameRes.json()).error.code).toBe("same_password");
  });

  it("rejects wrong current password and rate-limits repeated failed attempts", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-2", email: "alex@users.bitewise.local", user_metadata: { username: "alex" } },
          },
        }),
        signInWithPassword,
      },
    } as never);

    for (let i = 0; i < 5; i++) {
      const res = await POST(
        makeRequest({
          currentPassword: "wrongpassword",
          newPassword: "newpassword456",
          confirmPassword: "newpassword456",
        }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_current_password");
    }

    const blockedRes = await POST(
      makeRequest({
        currentPassword: "wrongpassword",
        newPassword: "newpassword456",
        confirmPassword: "newpassword456",
      }),
    );
    expect(blockedRes.status).toBe(429);
    expect((await blockedRes.json()).error.code).toBe("rate_limited");
  });

  it("verifies current password, updates password via admin, and refreshes session", async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: { id: "user-3" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: "user-3" } },
        error: null,
      });

    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: { id: "user-3" } },
      error: null,
    });

    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-3", email: "alex@users.bitewise.local", user_metadata: { username: "alex" } },
          },
        }),
        signInWithPassword,
      },
    } as never);

    mockedCreateAdminClient.mockReturnValue({
      auth: {
        admin: { updateUserById },
      },
    } as never);

    const res = await POST(
      makeRequest({
        currentPassword: "oldpassword123",
        newPassword: "newpassword456",
        confirmPassword: "newpassword456",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: true });
    expect(signInWithPassword).toHaveBeenNthCalledWith(1, {
      email: "alex@users.bitewise.local",
      password: "oldpassword123",
    });
    expect(updateUserById).toHaveBeenCalledWith("user-3", {
      password: "newpassword456",
    });
    expect(signInWithPassword).toHaveBeenNthCalledWith(2, {
      email: "alex@users.bitewise.local",
      password: "newpassword456",
    });
  });
});
