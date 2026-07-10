/**
 * Storage-provider abstraction.
 *
 * A `StorageProvider` hides where item images live. The default provider
 * writes to the local filesystem under `public/uploads` (unchanged legacy
 * behavior); an S3/R2 provider stores the same objects in an object store.
 *
 * Keys are bare object names like `<uuid>.webp` or `<uuid>_hd.webp` — never
 * with a leading slash and never with the `/uploads/` prefix. Use
 * `keyFromUrl()` to derive a key from a stored (relative) URL.
 */
export interface StorageProvider {
  /** Write `body` under `key` with the given content type. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Read the object stored at `key`. Rejects if it does not exist. */
  get(key: string): Promise<Buffer>;
  /** Remove the object at `key`. Best-effort — a missing object is not an error. */
  delete(key: string): Promise<void>;
  /**
   * Public URL for `key`. For the local provider this is the relative
   * `/uploads/<key>` path (served via the `/api/uploads` rewrite); for an
   * object store it is the absolute CDN/public base URL.
   */
  url(key: string): string;
}
