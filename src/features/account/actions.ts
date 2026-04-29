"use server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { geocode } from "@/lib/geocoding";
import { phoneMatchesCountry } from "@/lib/phone";

const SUPPORTED_LOCALES = ["en", "fr"] as const;
const SUPPORTED_DISTANCE_UNITS = ["km", "mi"] as const;
const SUPPORTED_COUNTRIES = ["US", "CA", "FR"] as const;
type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

function clampCountry(value: unknown): CountryCode | null {
  return SUPPORTED_COUNTRIES.includes(value as CountryCode)
    ? (value as CountryCode)
    : null;
}

const COUNTRY_DEFAULT_DISTANCE_UNIT: Record<CountryCode, "km" | "mi"> = {
  US: "mi",
  CA: "km",
  FR: "km",
};

type AppLocale = (typeof SUPPORTED_LOCALES)[number];
type DistanceUnit = (typeof SUPPORTED_DISTANCE_UNITS)[number];

function clampLocale(value: unknown): AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
    ? (value as AppLocale)
    : "en";
}

function clampUnit(value: unknown): DistanceUnit {
  return SUPPORTED_DISTANCE_UNITS.includes(value as DistanceUnit)
    ? (value as DistanceUnit)
    : "km";
}

function clampCurrency(value: unknown): CurrencyCode {
  return isCurrencyCode(value) ? value : "USD";
}

/**
 * Update the signed-in user's basic profile fields. Phone, when
 * provided alongside a saved location country, is validated against
 * the country's E.164 dial-in prefix — refusing local-format numbers
 * we couldn't reach reliably from email reminders / messaging.
 *
 * On phone/country mismatch we redirect with ?error=phone_country_mismatch
 * and skip the DB write so the form preserves the user's input on
 * page reload.
 */
export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailVisibilityRaw = String(
    formData.get("emailVisibility") ?? "hidden"
  );
  const emailVisibility: "hidden" | "direct" =
    emailVisibilityRaw === "direct" ? "direct" : "hidden";

  if (phoneRaw) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: { countryCode: true },
    });
    const country = profile?.countryCode;
    if (country && !phoneMatchesCountry(phoneRaw, country)) {
      redirect("/account?error=phone_country_mismatch");
    }
  }

  await db
    .update(profiles)
    .set({
      displayName: displayName || null,
      phone: phoneRaw || null,
      emailVisibility,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/account");
}

/**
 * Update the signed-in user's communication preferences. Drives:
 * - locale of outgoing emails sent TO this user
 * - distance unit displayed on radius/distance labels
 * - default currency in the item creation form (when this user sells)
 *
 * Each value is clamped to the supported set, so a malformed POST body
 * silently falls back to the safe default rather than 500ing.
 */
export async function updateAccountPreferencesAction(formData: FormData) {
  const user = await requireUser();

  const preferredLocale = clampLocale(formData.get("preferredLocale"));
  const distanceUnit = clampUnit(formData.get("distanceUnit"));
  const defaultCurrency = clampCurrency(formData.get("defaultCurrency"));

  await db
    .update(profiles)
    .set({
      preferredLocale,
      distanceUnit,
      defaultCurrency,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/account");
}

/**
 * Persist (and geocode) the user's approximate location. Postal code +
 * country only — never browser GPS — so we never need to ask for the
 * Geolocation permission. The Nominatim call may fail (rate limit,
 * unknown postal); we still persist the country + postal text so the
 * user can re-save later and we'll re-geocode then. lat/lng are nulled
 * out in that case so radius queries silently skip this user.
 */
export async function updateLocationAction(formData: FormData) {
  const user = await requireUser();

  const country = clampCountry(formData.get("countryCode"));
  const postal = String(formData.get("postalCode") ?? "").trim();

  // Both blank → user explicitly cleared their location. Wipe coords too.
  if (!country && !postal) {
    await db
      .update(profiles)
      .set({
        countryCode: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        locationUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));
    revalidatePath("/account");
    return;
  }

  // Partial input — country alone or postal alone. Persist what we
  // got but don't geocode (no point), and don't wipe the other field
  // (previous bug: picking a country with empty postal silently
  // erased the country too on the next page render). Coords are
  // nulled because they're meaningless without both halves.
  if (!country || !postal) {
    await db
      .update(profiles)
      .set({
        countryCode: country ?? null,
        postalCode: postal || null,
        latitude: null,
        longitude: null,
        locationUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));
    revalidatePath("/account");
    redirect("/account?error=location_incomplete");
  }

  const resolved = await geocode({ countryCode: country, postalCode: postal });

  // If the user hasn't set distance_unit explicitly to something
  // different from the country default, auto-align it. We don't know
  // for sure they "haven't" — but switching the default to mi for a
  // US user who never touched the toggle is the right behavior.
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { distanceUnit: true, countryCode: true },
  });
  const previousCountry = profile?.countryCode ?? null;
  const expectedUnitForPrevious = previousCountry
    ? COUNTRY_DEFAULT_DISTANCE_UNIT[previousCountry as CountryCode]
    : null;
  const userTouchedUnit =
    profile?.distanceUnit != null &&
    expectedUnitForPrevious != null &&
    profile.distanceUnit !== expectedUnitForPrevious;
  const distanceUnit = userTouchedUnit
    ? profile?.distanceUnit
    : COUNTRY_DEFAULT_DISTANCE_UNIT[country];

  await db
    .update(profiles)
    .set({
      countryCode: country,
      postalCode: postal,
      latitude: resolved?.latitude ?? null,
      longitude: resolved?.longitude ?? null,
      distanceUnit,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/account");
  revalidatePath("/");
}
