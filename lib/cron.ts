import { logger } from "@/lib/logger";

export async function runCronJob<T extends Record<string, unknown>>(name: string, task: () => Promise<T>): Promise<T> {
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
