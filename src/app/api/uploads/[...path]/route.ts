import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getStorage, keyFromUrl } from "@/lib/storage";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filename = segments.join("/");

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("~")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Object store: redirect to the object's public URL. (With S3 the DB stores
  // absolute URLs, so this route is mostly a compatibility fallback.)
  if (process.env.STORAGE_PROVIDER === "s3") {
    return NextResponse.redirect(getStorage().url(keyFromUrl(filename)), 302);
  }

  const filePath = path.join(process.cwd(), "public", "uploads", filename);

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
