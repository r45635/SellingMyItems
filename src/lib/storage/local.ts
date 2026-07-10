import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import path from "path";
import type { StorageProvider } from "./types";

/**
 * Filesystem-backed storage provider — the default. Reproduces the exact
 * legacy behavior: objects live under `public/uploads`, are served through
 * the `/uploads/:path*` → `/api/uploads/:path*` rewrite, and stored URLs are
 * the relative `/uploads/<key>` path.
 *
 * This provider never imports the AWS SDK, so the local runtime path stays
 * free of object-store dependencies.
 */
export class LocalProvider implements StorageProvider {
  private readonly dir = path.join(process.cwd(), "public", "uploads");

  private pathFor(key: string): string {
    return path.join(this.dir, key);
  }

  // contentType is unused for local files; the interface's trailing param is
  // omitted here (TypeScript allows a method with fewer params to implement it).
  async put(key: string, body: Buffer): Promise<void> {
    // mkdir recursive is idempotent — matches the pre-loop mkdir the upload
    // route used to do before every writeFile.
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(key), body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch (err) {
      // File already gone or never existed — not a fatal error.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
  }

  url(key: string): string {
    return `/uploads/${key}`;
  }
}
