import path from "path";
import { readFile } from "fs/promises";
import sharp from "sharp";

/**
 * Load an image referenced by `url` (typically `/uploads/<file>`) and return
 * it as a PNG Buffer that @react-pdf/renderer can embed. WebP and other
 * formats are normalized to PNG via sharp because @react-pdf/renderer's
 * Image component only reliably handles JPEG/PNG.
 *
 * Returns null when the file cannot be read so callers can render a
 * placeholder.
 */
export async function loadImageForPdf(
  url: string | null | undefined
): Promise<Buffer | null> {
  const raw = await readRawImage(url);
  if (!raw) return null;
  try {
    // Normalize to PNG. Resize to a sensible max so the PDF stays small —
    // 1600px on the longest side is plenty for a print-quality A4 page.
    return await sharp(raw)
      .rotate() // honor EXIF orientation
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    console.error("Failed to normalize image for PDF:", err);
    return null;
  }
}

async function readRawImage(
  url: string | null | undefined
): Promise<Buffer | null> {
  if (!url) return null;

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

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  return null;
}
