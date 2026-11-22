import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateClient = vi.mocked(createClient);
const validInput = {
  username: "Alex_Test",
  password: "StrongPass123!",
  acceptedTerms: true,
};

function request(body: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("signup route (username + password + explicit terms consent)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitMemoryForTests();
  });

  it("rejects invalid signup input before contacting Supabase", async () => {
    const response = await POST(request({ ...validInput, username: "bad name" }));
    expect(response.status).toBe(400);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("rejects reserved system usernames before contacting Supabase", async () => {
    const response = await POST(request({ ...validInput, username: "admin" }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("username_reserved");
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects signup when acceptedTerms is missing or false before contacting Supabase", async () => {
    const missingRes = await POST(
      request({ username: "Alex_Test", password: "StrongPass123!" }),
    );
    const missingJson = await missingRes.json();
    expect(missingRes.status).toBe(400);
    expect(missingJson.error.code).toBe("terms_required");

    const falseRes = await POST(
      request({ ...validInput, acceptedTerms: false }),
    );
    const falseJson = await falseRes.json();
    expect(falseRes.status).toBe(400);
    expect(falseJson.error.code).toBe("terms_required");
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("creates an immediately confirmed user with accepted_terms_at metadata and escaped ILIKE check", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const ilike = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ ilike }));
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: "2026-11-22T00:00:00Z" } },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
      auth: { admin: { createUser } },
    } as never);
    mockedCreateClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as never);

    const response = await POST(request(validInput));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ userId: "user-1", verificationRequired: false });
    expect(ilike).toHaveBeenCalledWith("username", "Alex\\_Test");
    expect(createUser).toHaveBeenCalledWith({
      email: "alex_test@users.bitewise.local",
      password: validInput.password,
      email_confirm: true,
      user_metadata: {
        username: validInput.username,
        accepted_terms_at: expect.any(String),
      },
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "alex_test@users.bitewise.local",
      password: validInput.password,
    });
  });

  it("maps duplicate auth user collisions cleanly to username_taken", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const ilike = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ ilike }));
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
      auth: { admin: { createUser } },
    } as never);

    const response = await POST(request(validInput));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("username_taken");
    expect(payload.error.message).toBe("That username is already taken.");
  });

  it("rejects mismatched confirmPassword before contacting Supabase", async () => {
    const response = await POST(
      request({
        ...validInput,
        confirmPassword: "DifferentPassword999!",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("password_mismatch");
    expect(payload.error.message).toBe("Passwords do not match.");
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });
});
