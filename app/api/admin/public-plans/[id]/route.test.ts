import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

const ctx = { params: Promise.resolve({ id: "99" }) };

describe("/api/admin/public-plans/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-admin callers (even with spoofed user_metadata.is_admin) with 403", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "u-1",
              email: "u@users.bitewise.local",
              app_metadata: {},
              user_metadata: { username: "admin", is_admin: true },
            },
          },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { username: "u", is_admin: false }, error: null }),
          })),
        })),
      })),
    } as never);

    const res = await PATCH(
      new Request("http://localhost/api/admin/public-plans/99", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "private" }),
      }),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("allows admins to unpublish a public meal plan back to private (scoped to visibility = public)", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "u-admin",
              email: "admin@users.bitewise.local",
              app_metadata: { is_admin: true },
              user_metadata: { username: "admin" },
            },
          },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { username: "admin", is_admin: true }, error: null }),
          })),
        })),
      })),
    } as never);

    const eqVisibility = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 99, visibility: "private" }, error: null }),
      })),
    }));
    const eqId = vi.fn(() => ({ eq: eqVisibility }));

    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({ eq: eqId })),
      })),
    } as never);

    const res = await PATCH(
      new Request("http://localhost/api/admin/public-plans/99", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "private" }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(eqId).toHaveBeenCalledWith("id", 99);
    expect(eqVisibility).toHaveBeenCalledWith("visibility", "public");
    expect(await res.json()).toEqual({ id: 99, visibility: "private" });
  });
});
