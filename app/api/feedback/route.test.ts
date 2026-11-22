import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { resetFeedbackRateLimitForTests } from "@/lib/feedback-rate-limit";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function makePost(body: unknown, ip = "203.0.113.10") {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("public /api/feedback (accessible from Login without an account)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeedbackRateLimitForTests();
    resetRateLimitMemoryForTests();
  });

  it("allows unauthenticated visitors to submit feedback, omits userId, and enforces hourly IP rate limit", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "internal-user-uuid",
        username_snapshot: "Visitor",
        overall_rating: 5,
        focus_area: "meal_logging",
        logging_ease: "very_easy",
        most_wanted: "Faster food search",
        message: "Add quick serving presets for rice and chicken",
        status: "new",
        admin_note: null,
        reviewed_at: null,
        created_at: "2026-11-22T09:00:00Z",
        updated_at: "2026-11-22T09:00:00Z",
      },
      error: null,
    });

    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
      })),
    } as never);

    const badRes = await POST(
      makePost({
        overallRating: 6,
        focusArea: "meal_logging",
        loggingEase: "very_easy",
        message: "short",
      }),
    );
    expect(badRes.status).toBe(400);

    for (let i = 0; i < 10; i++) {
      const okRes = await POST(
        makePost({
          senderName: "Visitor",
          overallRating: 5,
          focusArea: "meal_logging",
          loggingEase: "very_easy",
          mostWanted: "Faster food search",
          message: "Add quick serving presets for rice and chicken",
        }),
      );
      expect(okRes.status).toBe(201);
      const body = await okRes.json();
      expect(body.item).not.toHaveProperty("userId");
    }

    const limitedRes = await POST(
      makePost({
        overallRating: 5,
        focusArea: "meal_logging",
        loggingEase: "very_easy",
        message: "Eleventh submission from same IP within an hour",
      }),
    );
    expect(limitedRes.status).toBe(429);
  });

  it("returns empty array when no submitted IDs are requested on GET", async () => {
    const res = await GET(new Request("http://localhost/api/feedback"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });
});
