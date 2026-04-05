import { defineRouting } from "next-intl/routing";
import { siteConfig } from "@/config";

export const routing = defineRouting({
  locales: siteConfig.locales,
  defaultLocale: siteConfig.defaultLocale,
});
