/**
 * Single source of truth for price + distance formatting. Replaces the
 * dozens of inline `Intl.NumberFormat` calls scattered across pages so
 * we have one place to maintain locale fallbacks, currency symbol
 * choices, and unit conventions.
 */

import type { CurrencyCode } from "@/lib/currency";

type AppLocale = "en" | "fr";

const INTL_LOCALES: Record<AppLocale, string> = {
  en: "en-US",
  fr: "fr-FR",
};

function intlLocale(locale?: string): string {
  return locale === "fr" ? INTL_LOCALES.fr : INTL_LOCALES.en;
}

/**
 * Format a price using the seller's chosen currency and the viewer's
 * locale. We never convert between currencies — the seller dictates
 * the price, the buyer sees it as priced.
 */
export function formatPrice(
  amount: number,
  currency: CurrencyCode,
  locale?: string
): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    // If a downstream library or browser doesn't know the currency
    // code (shouldn't happen given our enum), fall back to a plain
    // numeric + suffix so we never crash a server render.
    return `${amount} ${currency}`;
  }
}

export type DistanceUnit = "km" | "mi";

const KM_PER_MILE = 1.609344;

export function kmToMi(km: number): number {
  return km / KM_PER_MILE;
}

/**
 * Format a distance value (input always in kilometres — that's the
 * canonical unit we store) into the user's preferred unit.
 */
export function formatDistance(
  km: number,
  unit: DistanceUnit,
  locale?: string
): string {
  const value = unit === "mi" ? kmToMi(km) : km;
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(rounded);
  return `${formatted} ${unit}`;
}
