/**
 * E.164 dial-in prefixes per country we currently support. US and CA
 * share +1 (NANP). Used by the account page to validate that a saved
 * phone matches the user's location country — protects us from local-
 * format numbers we couldn't reach reliably from email/SMS reminders.
 */
export const COUNTRY_PHONE_PREFIXES = {
  US: ["+1"],
  CA: ["+1"],
  FR: ["+33"],
} as const;

export type SupportedPhoneCountry = keyof typeof COUNTRY_PHONE_PREFIXES;

/**
 * Strip whitespace, dashes, dots, and parentheses but keep the
 * leading + sign so prefix checks still work.
 */
export function normalizePhoneInput(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

export function phoneMatchesCountry(
  phone: string,
  country: string
): boolean {
  const normalized = normalizePhoneInput(phone);
  if (!normalized) return true; // empty phone is always OK
  const prefixes =
    country in COUNTRY_PHONE_PREFIXES
      ? COUNTRY_PHONE_PREFIXES[country as SupportedPhoneCountry]
      : null;
  if (!prefixes) return true; // unknown country → don't block
  return (prefixes as readonly string[]).some((p) =>
    normalized.startsWith(p)
  );
}
