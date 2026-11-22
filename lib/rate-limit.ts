import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

type MemoryBucket = {
  count: number;
  resetAt: number;
};

const MAX_MEMORY_BUCKETS = 2_000;
const memoryBuckets = new Map<string, MemoryBucket>();

/**
 * Extracts client IP preferring platform-verified edge headers over spoofable x-forwarded-for.
 */
export function getTrustedClientIp(request: Request): string {
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercelIp) return vercelIp;

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return "local";
}

function consumeMemoryRateLimit(key: string, windowSeconds: number, limit: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    for (const [k, entry] of memoryBuckets.entries()) {
      if (now >= entry.resetAt) memoryBuckets.delete(k);
    }
    if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
      const oldest = memoryBuckets.keys().next().value;
      if (oldest) memoryBuckets.delete(oldest);
    }
  }

  const current = memoryBuckets.get(key);
  if (!current || now >= current.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  memoryBuckets.set(key, current);
  return true;
}

/**
 * Claims a slot in the Postgres-backed distributed rate limiter (`public.claim_rate_limit`),
 * falling back cleanly to a bounded in-memory bucket in isolated test/dev environments
 * when the RPC is unavailable.
 */
export async function claimRateLimit({
  key,
  windowSeconds,
  limit,
  message = "Too many requests right now. Please wait a moment and try again.",
  code = "rate_limited",
}: {
  key: string;
  windowSeconds: number;
  limit: number;
  message?: string;
  code?: string;
}): Promise<void> {
  let allowed: boolean | null = null;

  try {
    const admin = createAdminClient();
    if (admin && typeof admin.rpc === "function") {
      const { data, error } = await admin.rpc("claim_rate_limit", {
        p_key: key.slice(0, 200),
        p_window_seconds: windowSeconds,
        p_limit: limit,
      });
      if (!error && typeof data === "boolean") {
        allowed = data;
      }
    }
  } catch {
    // Fall back to bounded memory limiter if env or migration is unavailable (e.g. unit tests).
  }

  if (allowed === null) {
    allowed = consumeMemoryRateLimit(key, windowSeconds, limit);
  }

  if (!allowed) {
    throw new ApiError(429, message, code);
  }
}

/**
 * Claims a slot in the global per-minute AI rate limiter via service_role.
 * Includes a zero-downtime compatibility fallback to the caller's authenticated
 * client strictly when legacy migration 0007 (pre-0025) rejects service_role with
 * `not authorized`.
 */
export async function claimGlobalAiRateLimit(
  limit = 60,
  fallbackClient?: SupabaseClient,
): Promise<boolean> {
  const bucketStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const admin = createAdminClient();
  let { data, error } = await admin.rpc("claim_global_ai_rate_limit", {
    p_bucket_start: bucketStart,
    p_limit: limit,
  });

  if (error && /not authorized/i.test(error.message ?? "") && fallbackClient) {
    logger.warn("migration_0025_pending", { rpc: "claim_global_ai_rate_limit" });
    const fallback = await fallbackClient.rpc("claim_global_ai_rate_limit", {
      p_bucket_start: bucketStart,
      p_limit: limit,
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new ApiError(
      503,
      "AI rate limiting is not configured yet. Apply the security migrations first.",
      "ai_rate_limit_unavailable",
    );
  }

  return Boolean(data);
}

export function resetRateLimitMemoryForTests(): void {
  memoryBuckets.clear();
}
