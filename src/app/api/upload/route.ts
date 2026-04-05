import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (raw from phone camera)
const MAX_DIMENSION = 1920; // Max width or height after resize
const JPEG_QUALITY = 80;

export async function POST(request: NextRequest) {
  // Check demo auth cookie (same as dev-session)
  const demoRole = request.cookies.get("demo_role")?.value;
  if (!demoRole) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json(
      { error: "Aucun fichier fourni" },
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
          error: `Type non autorisé: ${file.type}. Formats acceptés: JPEG, PNG, WebP, GIF, AVIF`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max 20 Mo): ${file.name}` },
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
      .webp({ quality: JPEG_QUALITY })
      .toBuffer();

    await writeFile(filePath, processed);

    urls.push(`/uploads/${fileName}`);
  }

  return NextResponse.json({ urls });
}
