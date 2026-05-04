import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (raw from phone camera)
const MAX_FILES_PER_REQUEST = 8;
const STD_DIMENSION = 1024; // Standard display resolution
const STD_QUALITY = 72;
const HD_DIMENSION = 1920; // Full-resolution variant for zoom
const HD_QUALITY = 80;

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateKey = `upload:post:user:${user.id}:${ip ?? "unknown"}`;
  const rateCheck = await consumeRateLimit(rateKey, {
    windowMs: 5 * 60 * 1000,
    max: 20,
  });
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: "Too many attempts, please try again in a few minutes" },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json(
      { error: "No files provided" },
      { status: 400 }
    );
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES_PER_REQUEST} per request)` },
      { status: 400 }
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const urls: string[] = [];
  const hdUrls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed formats: JPEG, PNG, WebP, GIF, AVIF`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max 20 MB): ${file.name}` },
        { status: 400 }
      );
    }

    const uuid = randomUUID();
    const stdFileName = `${uuid}.webp`;
    const hdFileName = `${uuid}_hd.webp`;
    const stdPath = path.join(uploadDir, stdFileName);
    const hdPath = path.join(uploadDir, hdFileName);

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Auto-rotate once from EXIF, then branch into two variants
    const rotated = sharp(rawBuffer).rotate();

    // Standard variant: 1024px, quality 72 — fast to load for normal display
    const stdProcessed = await rotated
      .clone()
      .resize(STD_DIMENSION, STD_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: STD_QUALITY, effort: 4 })
      .toBuffer();

    // HD variant: 1920px, quality 80 — loaded only when user opens fullscreen zoom
    const hdProcessed = await rotated
      .clone()
      .resize(HD_DIMENSION, HD_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: HD_QUALITY, effort: 4 })
      .toBuffer();

    await writeFile(stdPath, stdProcessed);
    await writeFile(hdPath, hdProcessed);

    urls.push(`/uploads/${stdFileName}`);
    hdUrls.push(`/uploads/${hdFileName}`);
  }

  return NextResponse.json({ urls, hdUrls });
}
