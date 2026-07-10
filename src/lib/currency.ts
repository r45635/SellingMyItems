/**
 * Single canonical list of supported currencies. Mirrors the
 * `currency_code` enum in the DB schema and the zod enum in
 * lib/validations.ts. Update all three together if you ever add a
 * new currency.
 */

export const CURRENCY_CODES = ["USD", "EUR", "CAD", "GBP"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (CURRENCY_CODES as readonly string[]).includes(value)
  );
}

const COUNTRY_DEFAULT_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD",
  CA: "CAD",
  FR: "EUR",
  GB: "GBP",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  BE: "EUR",
  NL: "EUR",
  PT: "EUR",
  IE: "EUR",
  AT: "EUR",
  LU: "EUR",
};

/**
 * Best-guess default currency from a user's country code. Used to
 * pre-fill the item creation form for a new seller — they can still
 * override per item.
 */
export function defaultCurrencyForCountry(
  countryCode?: string | null
): CurrencyCode {
  if (!countryCode) return "USD";
  return COUNTRY_DEFAULT_CURRENCY[countryCode.toUpperCase()] ?? "USD";
}

// Exchange rates updated manually ~monthly. Used for display hints only —
// no stored conversions, sellers always price in their own currency.
export const FX_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
  USD: { USD: 1, EUR: 0.92, CAD: 1.36, GBP: 0.79 },
  EUR: { USD: 1.09, EUR: 1,   CAD: 1.48, GBP: 0.86 },
  CAD: { USD: 0.74, EUR: 0.68, CAD: 1,   GBP: 0.58 },
  GBP: { USD: 1.27, EUR: 1.17, CAD: 1.72, GBP: 1 },
};

export function convertApprox(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  return Math.round(amount * FX_RATES[from][to]);
}

export function localeToCurrency(locale: string): CurrencyCode {
  if (locale === "fr") return "EUR";
  return "USD";
}
