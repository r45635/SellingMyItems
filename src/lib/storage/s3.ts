import type { S3Client } from "@aws-sdk/client-s3";
import type { StorageProvider } from "./types";

/**
 * S3-compatible object-store provider (AWS S3, Cloudflare R2, MinIO, …).
 *
 * A custom `endpoint` makes it work against non-AWS stores such as R2.
 *
 * The `@aws-sdk/client-s3` package is imported LAZILY (dynamic `import()`
 * inside the async methods) — the module top only pulls `import type`, which
 * is erased at compile time. This keeps the SDK from being evaluated on the
 * default local runtime path even though `index.ts` statically references
 * this class: `S3Provider` is only ever constructed when STORAGE_PROVIDER=s3,
 * and the SDK is only loaded on first put/get/delete.
 *
 * Config is read from env once at construction:
 *   STORAGE_BUCKET, STORAGE_ENDPOINT, STORAGE_REGION,
 *   STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_PUBLIC_BASE_URL
 */
export class S3Provider implements StorageProvider {
  private client: S3Client | null = null;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;
    const region = process.env.STORAGE_REGION;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL;

    if (
      !bucket ||
      !endpoint ||
      !region ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicBaseUrl
    ) {
      throw new Error(
        "[storage] STORAGE_PROVIDER=s3 requires STORAGE_BUCKET, STORAGE_ENDPOINT, " +
          "STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, and " +
          "STORAGE_PUBLIC_BASE_URL to be set."
      );
    }

    this.bucket = bucket;
    this.endpoint = endpoint;
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    // Strip a single trailing slash so url() never produces a double slash.
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  /** Lazily construct and memoize the S3 client (loads the SDK on first use). */
  private async getClient(): Promise<S3Client> {
    if (this.client) return this.client;
    const { S3Client } = await import("@aws-sdk/client-s3");
    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      // Path-style addressing is the most compatible choice for custom
      // endpoints like R2 and MinIO (avoids bucket-name-in-subdomain issues).
      forcePathStyle: true,
    });
    return this.client;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const [client, { PutObjectCommand }] = await Promise.all([
      this.getClient(),
      import("@aws-sdk/client-s3"),
    ]);
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  }

  async get(key: string): Promise<Buffer> {
    const [client, { GetObjectCommand }] = await Promise.all([
      this.getClient(),
      import("@aws-sdk/client-s3"),
    ]);
    const res = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    if (!res.Body) {
      throw new Error(`[storage] Empty body for key: ${key}`);
    }
    // SdkStream exposes transformToByteArray() in the Node.js runtime.
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    const [client, { DeleteObjectCommand }] = await Promise.all([
      this.getClient(),
      import("@aws-sdk/client-s3"),
    ]);
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  url(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
