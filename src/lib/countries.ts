/**
 * Single canonical list of supported countries. Mirrors the country
 * gates in lib/phone.ts (phone validation + prefix hints), the zod
 * enum in lib/validations.ts, and the country <select> options in the
 * account and project forms. Update this list and everything that
 * derives from it follows. Framework-free on purpose — no next imports.
 */

export const SUPPORTED_COUNTRIES = [
  { code: "US", dialPrefix: "+1" },
  { code: "CA", dialPrefix: "+1" },
  { code: "FR", dialPrefix: "+33" },
  { code: "GB", dialPrefix: "+44" },
  { code: "DE", dialPrefix: "+49" },
  { code: "ES", dialPrefix: "+34" },
  { code: "IT", dialPrefix: "+39" },
  { code: "BE", dialPrefix: "+32" },
  { code: "NL", dialPrefix: "+31" },
] as const;

export const SUPPORTED_COUNTRY_CODES = [
  "US",
  "CA",
  "FR",
  "GB",
  "DE",
  "ES",
  "IT",
  "BE",
  "NL",
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export function isCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === "string" &&
    (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(value)
  );
}

/**
 * Dial prefix (e.g. "+33") for a supported country, or null when the
 * code isn't one we support. Used to build the phone prefix hints.
 */
export function dialPrefixForCountry(countryCode: string): string | null {
  const match = SUPPORTED_COUNTRIES.find((c) => c.code === countryCode);
  return match ? match.dialPrefix : null;
}
