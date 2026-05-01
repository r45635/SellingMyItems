import type { MetadataRoute } from "next";
import { siteConfig } from "@/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/en/account",
        "/fr/account",
        "/en/my-intents",
        "/fr/my-intents",
        "/en/messages",
        "/fr/messages",
        "/en/notifications",
        "/fr/notifications",
        "/en/reservations",
        "/fr/reservations",
        "/en/purchases",
        "/fr/purchases",
        "/en/seller/",
        "/fr/seller/",
        "/en/admin/",
        "/fr/admin/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
