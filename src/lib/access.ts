import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  projectAccessGrants,
  projectInvitations,
  projectAccessRequests,
} from "@/db/schema";
import { and, eq, isNull, gt, sql, desc } from "drizzle-orm";

export const INVITATION_VALIDITY_PRESETS = [7, 30, 90] as const;
export type InvitationValidityDays = (typeof INVITATION_VALIDITY_PRESETS)[number];

/**
 * Generates a short, URL-safe invitation code (uppercase alphanumeric).
 * Format: XXXX-XXXX (8 chars + hyphen) — easy to type, hard to guess.
 */
export function generateInvitationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude O/0/I/1 for readability
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function computeExpiryDate(days: InvitationValidityDays): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function isValidityDays(value: unknown): value is InvitationValidityDays {
  return (
    typeof value === "number" &&
    (INVITATION_VALIDITY_PRESETS as readonly number[]).includes(value)
  );
}

/**
 * Does this user currently have an active grant to this project?
 */
export async function userHasProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  const grant = await db.query.projectAccessGrants.findFirst({
    where: and(
      eq(projectAccessGrants.projectId, projectId),
      eq(projectAccessGrants.userId, userId),
      isNull(projectAccessGrants.revokedAt)
    ),
    columns: { id: true },
  });
  return !!grant;
}

/**
 * Fetch an invitation by its code if still usable (active + not expired + not revoked).
 * Returns null if no match or expired.
 */
export async function findUsableInvitation(code: string) {
  const now = new Date();
  const invitation = await db.query.projectInvitations.findFirst({
    where: and(
      eq(projectInvitations.code, code),
      eq(projectInvitations.status, "active"),
      gt(projectInvitations.expiresAt, now),
      isNull(projectInvitations.revokedAt)
    ),
  });
  return invitation ?? null;
}

/**
 * Auto-claim any active targeted invitations addressed to the given email.
 * Creates access grants and marks each invitation as used.
 *
 * Called on signup and as a lazy check when a user lands on an invitation-only project.
 */
export async function claimTargetedInvitationsForEmail(
  userId: string,
  email: string
): Promise<number> {
  const emailLower = email.toLowerCase();
  const now = new Date();

  const matches = await db
    .select({
      id: projectInvitations.id,
      projectId: projectInvitations.projectId,
    })
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.email, emailLower),
        eq(projectInvitations.status, "active"),
        gt(projectInvitations.expiresAt, now),
        isNull(projectInvitations.revokedAt)
      )
    );

  if (matches.length === 0) return 0;

  let grantedCount = 0;
  for (const m of matches) {
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(projectAccessGrants)
        .values({
          projectId: m.projectId,
          userId,
          source: "targeted_invitation",
          invitationId: m.id,
        })
        .onConflictDoNothing()
        .returning({ id: projectAccessGrants.id });

      await tx
        .update(projectInvitations)
        .set({
          status: "used",
          usedByUserId: userId,
          usedAt: sql`now()`,
        })
        .where(eq(projectInvitations.id, m.id));

      if (inserted.length > 0) grantedCount++;
    });
  }
  return grantedCount;
}

/**
 * Returns buyer-side view state for a given (user, invitation-only project):
 * - granted: user has an active access grant (possibly just auto-claimed)
 * - pending: user has a pending access request
 * - declined: the most recent request was declined (and no grant yet)
 * - none: no grant, no request
 *
 * Also triggers auto-claim of any targeted invitation for this user's email.
 */
export async function computeProjectAccessState(
  userId: string,
  userEmail: string,
  projectId: string
): Promise<"granted" | "pending" | "declined" | "none"> {
  await claimTargetedInvitationsForEmail(userId, userEmail);

  if (await userHasProjectAccess(userId, projectId)) return "granted";

  const latestRequest = await db
    .select({ status: projectAccessRequests.status })
    .from(projectAccessRequests)
    .where(
      and(
        eq(projectAccessRequests.projectId, projectId),
        eq(projectAccessRequests.userId, userId)
      )
    )
    .orderBy(desc(projectAccessRequests.createdAt))
    .limit(1);

  if (latestRequest.length === 0) return "none";
  if (latestRequest[0].status === "pending") return "pending";
  if (latestRequest[0].status === "declined") return "declined";
  return "none";
}
