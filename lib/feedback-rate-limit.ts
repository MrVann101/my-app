import { ApiError } from "./api";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_HOUR = 10;

const submissions = new Map<string, { count: number; resetAt: number }>();

export function resetFeedbackRateLimitForTests() {
  submissions.clear();
}

export function consumeFeedbackRateLimit(userId: string) {
  const now = Date.now();
  const bucket = submissions.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    submissions.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= MAX_SUBMISSIONS_PER_HOUR) {
    throw new ApiError(
      429,
      "You have submitted several ideas recently. Please wait a little while before sending another.",
      "rate_limited",
    );
  }
  bucket.count += 1;
}
