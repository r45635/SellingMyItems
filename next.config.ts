import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { execFileSync } from "child_process";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Inject build info at build time
const gitHash = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
})();
const buildDate = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

// When images are served from an object store (STORAGE_PROVIDER=s3), stored
// URLs are absolute. Whitelist that host so next/image accepts them. Stays
// empty for local storage (relative /uploads URLs need no remotePattern).
const imageRemotePatterns: Array<{
  protocol?: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
}> = [];
if (process.env.STORAGE_PUBLIC_BASE_URL) {
  try {
    const base = new URL(process.env.STORAGE_PUBLIC_BASE_URL);
    imageRemotePatterns.push({
      protocol: base.protocol.replace(/:$/, "") as "http" | "https",
      hostname: base.hostname,
      port: base.port || undefined,
      pathname: "/**",
    });
  } catch {
    // Malformed STORAGE_PUBLIC_BASE_URL — leave remotePatterns empty.
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_ID: gitHash,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/:path*",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
