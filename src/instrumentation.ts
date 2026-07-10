/**
 * instrumentation.ts — runs once when the Next.js server starts.
 * Validates critical environment variables so the process fails fast
 * with a clear message instead of crashing deep inside the app.
 */
export async function register() {
  // Only validate in the Node.js runtime (not edge), and only on the server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const required: string[] = ["DATABASE_URL"];

  // Object-store storage needs its full config. Local storage (the default)
  // requires nothing extra.
  if (process.env.STORAGE_PROVIDER === "s3") {
    required.push(
      "STORAGE_BUCKET",
      "STORAGE_ENDPOINT",
      "STORAGE_REGION",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
      "STORAGE_PUBLIC_BASE_URL"
    );
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[startup] Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn(
      "[startup] NEXT_PUBLIC_APP_URL is not set — email links will point to localhost:3000"
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[startup] RESEND_API_KEY is not set — outgoing emails will fail silently"
    );
  }
}
