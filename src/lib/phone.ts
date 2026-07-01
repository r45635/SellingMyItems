import { isValidPhoneNumber, parsePhoneNumberWithError, type CountryCode } from "libphonenumber-js";

// Used by the UI to show a prefix hint (e.g., "+33") next to the phone input.
export const COUNTRY_PHONE_PREFIXES = {
  US: ["+1"],
  CA: ["+1"],
  FR: ["+33"],
} as const;

export type SupportedPhoneCountry = keyof typeof COUNTRY_PHONE_PREFIXES;

const SUPPORTED_COUNTRIES = new Set<CountryCode>(["US", "CA", "FR"]);

/**
 * Returns true when the phone number is valid for the given country, or
 * when the phone is empty (optional field) or the country is unsupported.
 */
export function phoneMatchesCountry(phone: string, country: string): boolean {
  if (!phone.trim()) return true;
  if (!SUPPORTED_COUNTRIES.has(country as CountryCode)) return true;
  try {
    return isValidPhoneNumber(phone, country as CountryCode);
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
    return parsePhoneNumberWithError(phone, country as CountryCode).format("E.164");
  } catch {
    return phone;
  }
}
