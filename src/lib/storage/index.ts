/**
 * Storage-provider factory.
 *
 * `getStorage()` returns the active `StorageProvider`, selected by the
 * `STORAGE_PROVIDER` env var: `"s3"` → object store, anything else / unset →
 * local filesystem (the default, byte-for-byte legacy behavior).
 *
 * The instance is memoized on `globalThis` so it survives Next.js hot-module
 * reloads in development without re-instantiating (same pattern as
 * `src/lib/security/redis-client.ts`).
 *
 * The AWS SDK is never evaluated on the local path: `S3Provider` imports the
 * SDK lazily inside its async methods (see `s3.ts`), so merely referencing the
 * class here does not load `@aws-sdk/client-s3`.
 */
import path from "path";
import type { StorageProvider } from "./types";
import { LocalProvider } from "./local";
import { S3Provider } from "./s3";

declare global {
  var __smiStorage: StorageProvider | undefined;
}

export function getStorage(): StorageProvider {
  if (globalThis.__smiStorage === undefined) {
    globalThis.__smiStorage =
      process.env.STORAGE_PROVIDER === "s3"
        ? new S3Provider()
        : new LocalProvider();
  }
  return globalThis.__smiStorage;
}

/**
 * Derive a storage key from a stored (relative) URL.
 * `/uploads/<uuid>.webp` → `<uuid>.webp`. Also handles absolute object-store
 * URLs since `path.basename` returns the last path segment.
 */
export function keyFromUrl(url: string): string {
  return path.basename(url);
}

export type { StorageProvider } from "./types";
