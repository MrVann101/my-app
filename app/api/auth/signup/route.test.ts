import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const validInput = { username: "alex_test", email: "alex@example.com", password: "StrongPass123!" };

function request(body: unknown) {
  return new Request("http://localhost/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("signup route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid signup input before contacting Supabase", async () => {
    const response = await POST(request({ ...validInput, username: "bad name" }));
    expect(response.status).toBe(400);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("returns verification state from Supabase Auth", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email_confirmed_at: null } }, error: null });
    mockedCreateClient.mockResolvedValue({ auth: { signUp } } as never);
    const response = await POST(request(validInput));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ userId: "user-1", verificationRequired: true });
    expect(signUp).toHaveBeenCalledWith({ email: validInput.email, password: validInput.password, options: { data: { username: validInput.username } } });
  });
});
