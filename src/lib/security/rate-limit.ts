/**
 * Rate limiting with a pluggable backend.
 *
 * When REDIS_URL is set the counters live in Redis (fixed-window via
 * INCR + EXPIRE) so they survive restarts and work across multiple
 * instances. When Redis is unavailable or REDIS_URL is not configured
 * the module falls back to an in-process Map — sufficient for single-node
 * deployments.
 *
 * All call sites must `await` the result.
 */

import { getRedisClient } from "./redis-client";

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

// ─── In-memory store (fallback) ──────────────────────────────────────────────

type Store = Map<string, Entry>;

declare global {
  // eslint-disable-next-line no-var
  var __smiRateLimitStore: Store | undefined;
}

function getStore(): Store {
  if (!globalThis.__smiRateLimitStore) {
    globalThis.__smiRateLimitStore = new Map<string, Entry>();
  }
  return globalThis.__smiRateLimitStore;
}

function pruneExpiredEntries(store: Store, now: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function consumeInMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const store = getStore();

  // Opportunistic cleanup keeps memory usage bounded in a single-node deployment.
  if (store.size > 1000) {
    pruneExpiredEntries(store, now);
  }

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: config.max - 1,
      retryAfterMs: config.windowMs,
    };
  }

  if (current.count >= config.max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    ok: true,
    remaining: config.max - current.count,
    retryAfterMs: Math.max(current.resetAt - now, 0),
  };
}

// ─── Redis store ─────────────────────────────────────────────────────────────

async function consumeRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  const redis = getRedisClient();
  if (!redis || redis.status !== "ready") return null;

  const windowSec = Math.ceil(config.windowMs / 1000);
  const redisKey = `rl:${key}`;

  try {
    // Atomic fixed-window counter: increment, then set expiry only on
    // the first hit (count === 1) so the window doesn't slide.
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    const ttl = await redis.pttl(redisKey);
    const retryAfterMs = ttl > 0 ? ttl : config.windowMs;

    if (count > config.max) {
      return { ok: false, remaining: 0, retryAfterMs };
    }

    return { ok: true, remaining: config.max - count, retryAfterMs };
  } catch {
    // Redis error — fall through to in-memory fallback.
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function consumeRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisResult = await consumeRedis(key, config);
  if (redisResult !== null) return redisResult;
  return consumeInMemory(key, config);
}

