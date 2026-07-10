import {
  isValidPhoneNumber,
  parsePhoneNumberWithError,
  type CountryCode as LibCountryCode,
} from "libphonenumber-js";
import { SUPPORTED_COUNTRIES as CANONICAL_COUNTRIES } from "@/lib/countries";

// Used by the UI to show a prefix hint (e.g., "+33") next to the phone
// input. Derived from the canonical country list so a new country picks
// up its prefix automatically. Shape kept as `{ CODE: ["+prefix"] }`.
type CountryCodeLiteral = (typeof CANONICAL_COUNTRIES)[number]["code"];

export const COUNTRY_PHONE_PREFIXES: Record<
  CountryCodeLiteral,
  readonly [string]
> = CANONICAL_COUNTRIES.reduce(
  (acc, c) => {
    acc[c.code] = [c.dialPrefix];
    return acc;
  },
  {} as Record<CountryCodeLiteral, [string]>
);

export type SupportedPhoneCountry = keyof typeof COUNTRY_PHONE_PREFIXES;

const SUPPORTED_COUNTRIES = new Set<LibCountryCode>(
  CANONICAL_COUNTRIES.map((c) => c.code as LibCountryCode)
);

/**
 * Returns true when the phone number is valid for the given country, or
 * when the phone is empty (optional field) or the country is unsupported.
 */
export function phoneMatchesCountry(phone: string, country: string): boolean {
  if (!phone.trim()) return true;
  if (!SUPPORTED_COUNTRIES.has(country as LibCountryCode)) return true;
  try {
    return isValidPhoneNumber(phone, country as LibCountryCode);
  } catch {
    return false;
  }
}

/**
 * Normalises a phone number to E.164 format (e.g. "+33612345678").
 * Returns the original string unchanged if parsing fails — this keeps
 * the save from being blocked while still storing the best format we can.
 */
export function normalizePhone(phone: string, country: string): string {
  if (!phone.trim()) return phone;
  try {
    return parsePhoneNumberWithError(phone, country as LibCountryCode).format("E.164");
  } catch {
    return phone;
  }
}
