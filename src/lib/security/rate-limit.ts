type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Store = Map<string, Entry>;

declare global {
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

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
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
