"use server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";

const SUPPORTED_LOCALES = ["en", "fr"] as const;
const SUPPORTED_DISTANCE_UNITS = ["km", "mi"] as const;

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
