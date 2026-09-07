import { describe, expect, it } from "vitest";
import { canCancelDeletion, deletionDeadline } from "@/lib/deletion";

describe("account deletion grace period", () => {
  const requestedAt = "2026-09-01T12:00:00.000Z";

  it("allows cancellation inside the 14-day window", () => {
    expect(canCancelDeletion(requestedAt, new Date("2026-09-10T12:00:00.000Z").getTime())).toBe(true);
  });

  it("rejects cancellation at and after the deadline", () => {
    const deadline = deletionDeadline(requestedAt).getTime();
    expect(canCancelDeletion(requestedAt, deadline)).toBe(false);
    expect(canCancelDeletion(requestedAt, deadline + 1)).toBe(false);
  });

  it("rejects cancellation when no request exists", () => {
    expect(canCancelDeletion(null)).toBe(false);
  });

  it("rejects cancellation when the timestamp is invalid", () => {
    expect(canCancelDeletion("not-a-date")).toBe(false);
  });
});
