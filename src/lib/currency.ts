/**
 * Single canonical list of supported currencies. Mirrors the
 * `currency_code` enum in the DB schema and the zod enum in
 * lib/validations.ts. Update all three together if you ever add a
 * new currency.
 */

export const CURRENCY_CODES = ["USD", "EUR", "CAD"] as const;

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
