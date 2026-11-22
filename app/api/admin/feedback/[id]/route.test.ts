import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: VALID_UUID }) };

describe("/api/admin/feedback/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks non-admin authenticated users (even with spoofed user_metadata.is_admin) with 403", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-normal",
              email: "sam@users.bitewise.local",
              app_metadata: {},
              user_metadata: { username: "sam", is_admin: true },
            },
          },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { username: "sam", is_admin: false }, error: null }),
          })),
        })),
      })),
    } as never);

    const res = await PATCH(
      new Request(`http://localhost/api/admin/feedback/${VALID_UUID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "planned" }),
      }),
      ctx,
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("rejects malformed non-UUID feedback IDs with 400", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-admin",
              email: "boss@users.bitewise.local",
              app_metadata: { is_admin: true },
              user_metadata: { username: "boss" },
            },
          },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { username: "boss", is_admin: true }, error: null }),
          })),
        })),
      })),
    } as never);

    const res = await PATCH(
      new Request("http://localhost/api/admin/feedback/not-a-uuid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "planned" }),
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_id");
  });

  it("allows admins to update status and adminNote and delete items", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-admin",
              email: "boss@users.bitewise.local",
              app_metadata: { is_admin: true },
              user_metadata: { username: "boss" },
            },
          },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { username: "boss", is_admin: true }, error: null }),
          })),
        })),
      })),
    } as never);

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: VALID_UUID,
        user_id: "user-1",
        username_snapshot: "alex",
        overall_rating: 4,
        focus_area: "weekly_planner",
        logging_ease: "okay",
        most_wanted: null,
        message: "Lock breakfast across all 7 days",
        status: "planned",
        admin_note: "Great idea, scheduled for next update!",
        reviewed_at: "2026-11-22T10:00:00Z",
        created_at: "2026-11-22T09:00:00Z",
        updated_at: "2026-11-22T10:00:00Z",
      },
      error: null,
    });

    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ id: VALID_UUID }], error: null }) })) })),
      })),
    } as never);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/admin/feedback/${VALID_UUID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "planned",
          adminNote: "Great idea, scheduled for next update!",
        }),
      }),
      ctx,
    );

    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.item.status).toBe("planned");
    expect(patchBody.item.adminNote).toBe("Great idea, scheduled for next update!");

    const delRes = await DELETE(
      new Request(`http://localhost/api/admin/feedback/${VALID_UUID}`, { method: "DELETE" }),
      ctx,
    );
    expect(delRes.status).toBe(200);
  });
});
