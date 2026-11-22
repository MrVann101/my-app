import { ApiError } from "./api";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export function resetPasswordRateLimitForTests() {
  failedAttempts.clear();
}

export function checkPasswordRateLimit(userId: string) {
  const now = Date.now();
  const bucket = failedAttempts.get(userId);
  if (!bucket) return;
  if (now >= bucket.resetAt) {
    failedAttempts.delete(userId);
    return;
  }
  if (bucket.count >= MAX_FAILED_ATTEMPTS) {
    throw new ApiError(
      429,
      "Too many incorrect password attempts. Wait 15 minutes and try again.",
      "rate_limited",
    );
  }
}

export function recordFailedPasswordAttempt(userId: string) {
  const now = Date.now();
  const bucket = failedAttempts.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    failedAttempts.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

export function clearFailedPasswordAttempts(userId: string) {
  failedAttempts.delete(userId);
}
