import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  appSettings,
  profiles,
  threadAliases,
  type threadAliasRoleEnum,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type AliasRole = (typeof threadAliasRoleEnum.enumValues)[number];

const RELAY_CONFIG_CACHE_MS = 5 * 60 * 1000;

let cachedRelayDomain: { value: string | null; expiresAt: number } = {
  value: null,
  expiresAt: 0,
};

let cachedRelayEnabled: { value: boolean; expiresAt: number } = {
  value: false,
  expiresAt: 0,
};

/** Domain used for alias addresses, e.g. `relay.toprecipes.best`. */
export async function getRelayDomain(): Promise<string | null> {
  if (cachedRelayDomain.expiresAt > Date.now() && cachedRelayDomain.value !== null) {
    return cachedRelayDomain.value;
  }
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "relay_domain"),
    });
    if (row?.value) {
      cachedRelayDomain = {
        value: row.value,
        expiresAt: Date.now() + RELAY_CONFIG_CACHE_MS,
      };
      return row.value;
    }
  } catch {
    // DB not ready — fall through to env
  }
  const envValue = process.env.RELAY_DOMAIN ?? null;
  cachedRelayDomain = {
    value: envValue,
    expiresAt: Date.now() + RELAY_CONFIG_CACHE_MS,
  };
  return envValue;
}

/** Feature flag: should outbound emails advertise relay aliases and should inbound routes be honored. */
export async function isRelayEnabled(): Promise<boolean> {
  if (cachedRelayEnabled.expiresAt > Date.now()) {
    return cachedRelayEnabled.value;
  }
  let enabled = false;
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "relay_enabled"),
    });
    if (row?.value) {
      enabled = row.value === "true";
    } else {
      enabled = process.env.RELAY_ENABLED === "true";
    }
  } catch {
    enabled = process.env.RELAY_ENABLED === "true";
  }
  if (enabled) {
    const domain = await getRelayDomain();
    if (!domain) enabled = false;
  }
  cachedRelayEnabled = {
    value: enabled,
    expiresAt: Date.now() + RELAY_CONFIG_CACHE_MS,
  };
  return enabled;
}

export function invalidateRelayCache() {
  cachedRelayDomain = { value: null, expiresAt: 0 };
  cachedRelayEnabled = { value: false, expiresAt: 0 };
}

/** Build the full alias address from a local part. Returns null when relay isn't configured. */
export async function aliasEmail(localPart: string): Promise<string | null> {
  const domain = await getRelayDomain();
  return domain ? `${localPart}@${domain}` : null;
}

function newLocalPart(): string {
  // 12 random hex chars → 48 bits of entropy, prefixed for human readability.
  return `t-${randomBytes(6).toString("hex")}`;
}

/**
 * Get or lazily mint the relay alias for a given (thread, role) pair.
 * Idempotent: concurrent calls return the same row thanks to the unique index.
 */
export async function getOrCreateThreadAlias(
  threadId: string,
  role: AliasRole,
  profileId: string
) {
  const existing = await db.query.threadAliases.findFirst({
    where: and(
      eq(threadAliases.threadId, threadId),
      eq(threadAliases.participantRole, role),
      isNull(threadAliases.revokedAt)
    ),
  });
  if (existing) return existing;

  // Retry a couple of times in case of local_part collision (extremely unlikely at 48 bits).
  for (let i = 0; i < 3; i++) {
    try {
      const [inserted] = await db
        .insert(threadAliases)
        .values({
          threadId,
          participantRole: role,
          profileId,
          localPart: newLocalPart(),
        })
        .returning();
      return inserted;
    } catch (err) {
      if (i === 2) throw err;
    }
  }
  throw new Error("Failed to mint thread alias");
}

/**
 * Look up an alias by local part. Returns the alias row plus the counterparty's profile
 * (who we should forward messages to) or null if the alias is unknown or revoked.
 */
export async function resolveAlias(localPart: string) {
  const alias = await db.query.threadAliases.findFirst({
    where: and(
      eq(threadAliases.localPart, localPart),
      isNull(threadAliases.revokedAt)
    ),
  });
  if (!alias) return null;

  const recipient = await db.query.profiles.findFirst({
    where: eq(profiles.id, alias.profileId),
    columns: { id: true, email: true, displayName: true },
  });
  if (!recipient) return null;

  return { alias, recipient };
}

/** Format a "Sender Name via SellingMyItems" string for outbound `From:` display names. */
export function formatSenderName(displayName: string | null | undefined): string {
  const name = displayName?.trim() || "Someone";
  return `${name} via SellingMyItems`;
}
