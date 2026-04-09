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
const MAX_DIMENSION = 1920; // Max width or height after resize
const WEBP_QUALITY = 75;

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateKey = `upload:post:user:${user.id}:${ip ?? "unknown"}`;
  const rateCheck = consumeRateLimit(rateKey, {
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

    const fileName = `${randomUUID()}.webp`;
    const filePath = path.join(uploadDir, fileName);

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Resize to max 1920px, convert to WebP, strip all EXIF/GPS metadata
    const processed = await sharp(rawBuffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer();

    await writeFile(filePath, processed);

    urls.push(`/uploads/${fileName}`);
  }

  return NextResponse.json({ urls });
}
