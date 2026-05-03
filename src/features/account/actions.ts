"use server";

import { db } from "@/db";
import {
  profiles,
  sessions,
  emailLogs,
  sellerAccounts,
  projects,
  items,
  itemImages,
  itemFiles,
  buyerIntents,
  conversationMessages,
  conversationThreads,
  deletionLog,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { geocode, type GeocodeFailureReason } from "@/lib/geocoding";
import { phoneMatchesCountry } from "@/lib/phone";
import bcrypt from "bcryptjs";
import { unlink } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";

/**
 * Map a geocode failure reason to a stable URL slug we use in
 * `?error=...` redirects. Keep these short — they're not visible to
 * users, but they show up in browser history. The /account page
 * matches on these to render the localized message.
 */
function geocodeReasonToErrorSlug(reason: GeocodeFailureReason): string {
  switch (reason) {
    case "invalid_input":
      return "geocode_invalid_input";
    case "no_match":
      return "geocode_no_match";
    case "unreachable":
      return "geocode_unreachable";
    case "bad_response":
      return "geocode_bad_response";
  }
}

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
 * Update the signed-in user's identity fields (display name and email
 * visibility). Phone is no longer part of this action — it moved to
 * updateLocationContactAction so it's validated against the country
 * submitted in the same form submission.
 */
export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const emailVisibilityRaw = String(
    formData.get("emailVisibility") ?? "hidden"
  );
  const emailVisibility: "hidden" | "direct" =
    emailVisibilityRaw === "direct" ? "direct" : "hidden";

  await db
    .update(profiles)
    .set({
      displayName: displayName || null,
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

/** @internal Kept only for retryGeocodeLocationAction. */
async function _geocodeAndSave({
  userId,
  country,
  postal,
}: {
  userId: string;
  country: CountryCode;
  postal: string;
}) {
  const resolved = await geocode({ countryCode: country, postalCode: postal });
  await db
    .update(profiles)
    .set({
      latitude: resolved.ok ? resolved.latitude : null,
      longitude: resolved.ok ? resolved.longitude : null,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
  revalidatePath("/account");
  revalidatePath("/");
  return resolved;
}

/**
 * Persist (and geocode) the user's approximate location AND phone.
 * Country + postal code only — never browser GPS. Phone is validated
 * against the SUBMITTED countryCode (not the one in the DB) so the
 * user can change country and phone in one save without hitting a
 * mismatch error from the stale DB value.
 *
 * The Nominatim call may fail; we still persist country + postal so
 * the user can re-save or use the retry button later.
 */
export async function updateLocationContactAction(formData: FormData) {
  const user = await requireUser();

  const country = clampCountry(formData.get("countryCode"));
  const postal = String(formData.get("postalCode") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  // Validate phone against the SUBMITTED country (not the DB value).
  if (phoneRaw && country && !phoneMatchesCountry(phoneRaw, country)) {
    redirect("/account?error=phone_country_mismatch");
  }

  // Both location fields blank → explicit clear.
  if (!country && !postal) {
    await db
      .update(profiles)
      .set({
        phone: phoneRaw || null,
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

  // Partial location — persist what we have but don't geocode.
  if (!country || !postal) {
    await db
      .update(profiles)
      .set({
        phone: phoneRaw || null,
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

  // Auto-align distance unit to country default unless user overrode it.
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
      phone: phoneRaw || null,
      countryCode: country,
      postalCode: postal,
      distanceUnit,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  const resolved = await _geocodeAndSave({
    userId: user.id,
    country,
    postal,
  });

  if (!resolved.ok) {
    redirect(`/account?error=${geocodeReasonToErrorSlug(resolved.reason)}`);
  }
}

/** @internal Legacy — no longer exposed to the UI. Kept so nothing explodes during transition. */
async function updateLocationAction(formData: FormData) {
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
      latitude: resolved.ok ? resolved.latitude : null,
      longitude: resolved.ok ? resolved.longitude : null,
      distanceUnit,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/account");
  revalidatePath("/");

  // On geocode failure, we still saved the user's typed values so
  // they don't have to re-type. Redirect with a reason-specific error
  // so /account renders the right banner ("retry", "code introuvable",
  // "service indisponible", …).
  if (!resolved.ok) {
    redirect(`/account?error=${geocodeReasonToErrorSlug(resolved.reason)}`);
  }
}

/**
 * Re-run geocoding against the location already on the user's
 * profile. Useful when the first save hit `unreachable` (transient)
 * — no need for the user to re-type country + postal.
 */
export async function retryGeocodeLocationAction() {
  const user = await requireUser();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { countryCode: true, postalCode: true },
  });
  if (!profile?.countryCode || !profile?.postalCode) {
    redirect("/account?error=location_incomplete");
  }

  const resolved = await geocode({
    countryCode: profile.countryCode,
    postalCode: profile.postalCode,
  });

  if (!resolved.ok) {
    revalidatePath("/account");
    redirect(`/account?error=${geocodeReasonToErrorSlug(resolved.reason)}`);
  }

  await db
    .update(profiles)
    .set({
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account?notice=geocode_resolved");
}

/**
 * Permanently delete the signed-in user's account and all associated data.
 * Requires the current password as confirmation.
 *
 * Cascade chain (via DB foreign keys):
 *   profiles → sessions, sellerAccounts → projects → items → itemImages/itemFiles
 *   profiles → buyerWishlists → wishlistItems
 *   profiles → buyerIntents → intentItems
 *   profiles → conversationThreads → conversationMessages
 *
 * email_logs has no FK → deleted explicitly by email address.
 * Uploaded files on disk are removed best-effort after the DB row is gone.
 */
export async function deleteAccountAction(formData: FormData) {
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  if (!password) {
    return { error: "passwordRequired" };
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { passwordHash: true, email: true },
  });
  if (!profile) {
    return { error: "notFound" };
  }

  const valid = await bcrypt.compare(password, profile.passwordHash);
  if (!valid) {
    return { error: "invalidPassword" };
  }

  // Collect file URLs from the user's items so we can clean up disk after
  // the DB cascade removes the rows themselves.
  const userItems = await db
    .select({ id: items.id })
    .from(items)
    .innerJoin(projects, eq(items.projectId, projects.id))
    .innerJoin(sellerAccounts, eq(projects.sellerId, sellerAccounts.id))
    .where(eq(sellerAccounts.userId, user.id));

  const itemIds = userItems.map((i) => i.id);
  const diskUrls: string[] = [];

  let imagesCount = 0;
  if (itemIds.length > 0) {
    const imgs = await db
      .select({ url: itemImages.url })
      .from(itemImages)
      .where(inArray(itemImages.itemId, itemIds));
    const files = await db
      .select({ url: itemFiles.url })
      .from(itemFiles)
      .where(inArray(itemFiles.itemId, itemIds));
    diskUrls.push(...imgs.map((r) => r.url), ...files.map((r) => r.url));
    imagesCount = imgs.length + files.length;
  }

  // Count buyer-side data for the deletion log.
  const [intentsRows, messagesRows] = await Promise.all([
    db
      .select({ id: buyerIntents.id })
      .from(buyerIntents)
      .where(eq(buyerIntents.userId, user.id)),
    db
      .select({ id: conversationMessages.id })
      .from(conversationMessages)
      .innerJoin(
        conversationThreads,
        eq(conversationMessages.threadId, conversationThreads.id)
      )
      .where(eq(conversationThreads.buyerId, user.id)),
  ]);

  // Delete email logs — no FK to profiles, must be deleted by email.
  await db.delete(emailLogs).where(eq(emailLogs.toEmail, profile.email));

  // Delete the profile — all FK-cascaded rows are removed automatically.
  await db.delete(profiles).where(eq(profiles.id, user.id));

  // Write GDPR Art. 17 audit entry (email stored as SHA-256 hash only).
  const emailHash = createHash("sha256").update(profile.email).digest("hex");
  await db.insert(deletionLog).values({
    emailHash,
    itemsCount: itemIds.length,
    imagesCount,
    messagesCount: messagesRows.length,
    intentsCount: intentsRows.length,
  });

  // Remove uploaded files from disk (best-effort; ignore missing files).
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  for (const url of diskUrls) {
    const filename = path.basename(url);
    if (filename && filename !== "." && filename !== "..") {
      try {
        await unlink(path.join(uploadsDir, filename));
      } catch {
        // File already gone or never existed — not a fatal error.
      }
    }
  }

  // Clear the session cookie so the browser doesn't hold a stale token.
  const cookieStore = await cookies();
  cookieStore.delete("session_token");

  redirect("/login");
}
