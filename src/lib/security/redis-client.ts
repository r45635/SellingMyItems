/**
 * Redis client singleton for rate limiting.
 *
 * Returns a connected ioredis instance when REDIS_URL is set, or null
 * when it is absent (e.g. local dev without Redis). All consumers must
 * handle the null case and fall back gracefully.
 *
 * The client is stored on `globalThis` so it survives Next.js hot-module
 * reloads in development without leaking connections.
 */

import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __smiRedisClient: Redis | null | undefined;
}

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (globalThis.__smiRedisClient === undefined) {
    const client = new Redis(process.env.REDIS_URL, {
      // Fail fast rather than queuing commands indefinitely.
      connectTimeout: 2000,
      commandTimeout: 1000,
      // Don't retry forever — if Redis is down fall back to in-memory.
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    client.on("error", (err) => {
      // Log but don't crash — the in-memory fallback will take over.
      console.error("[redis] connection error:", err.message);
    });

    globalThis.__smiRedisClient = client;
  }

  return globalThis.__smiRedisClient ?? null;
}
