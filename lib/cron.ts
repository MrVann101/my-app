import { createHash, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";

type CronMetrics = Record<string, string | number | boolean | null | undefined>;

/**
 * Constant-time verification of the `Authorization: Bearer <CRON_SECRET>` header.
 * Fails closed whenever CRON_SECRET is missing or empty.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length === 0) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const expected = `Bearer ${secret}`;
  const headerHash = createHash("sha256").update(header).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(headerHash, expectedHash);
}

export async function runCronJob<T extends CronMetrics>(name: string, task: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  logger.info("cron_started", { job: name });
  try {
    const result = await task();
    logger.info("cron_completed", { job: name, durationMs: Date.now() - startedAt, ...result });
    return result;
  } catch (error) {
    logger.error("cron_failed", { job: name, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "unknown_error" });
    throw error;
  }
}
