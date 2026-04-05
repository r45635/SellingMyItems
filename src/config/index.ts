export const siteConfig = {
  name: "SellingMyItems",
  description: "Publish items for sale and connect with buyers",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  defaultLocale: "en" as const,
  locales: ["en", "fr"] as const,
} as const;

export type Locale = (typeof siteConfig.locales)[number];
