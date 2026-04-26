import path from "path";
import { readFile } from "fs/promises";

/**
 * Load an image referenced by `url` (typically `/uploads/<file>`) into a
 * Buffer that @react-pdf/renderer can embed. Returns null when the file
 * cannot be read so callers can render a placeholder.
 */
export async function loadImageForPdf(
  url: string | null | undefined
): Promise<Buffer | null> {
  if (!url) return null;

  // Local upload served by /api/uploads/<path>: read from disk to avoid
  // round-tripping through the network during PDF generation.
  if (url.startsWith("/uploads/")) {
    const rel = url.slice("/uploads/".length);
    if (rel.includes("..") || rel.includes("~")) return null;
    const abs = path.join(process.cwd(), "public", "uploads", rel);
    try {
      return await readFile(abs);
    } catch {
      return null;
    }
  }

  // Absolute URL: fetch with a short timeout. Used for any remote image
  // (e.g. Supabase storage) the project might add later.
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    } catch {
      return null;
    }
  }

  return null;
}
