"use server";

import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  items,
  projects,
  sellerAccounts,
  profiles,
  itemShareLinks,
  projectAccessGrants,
} from "@/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { siteConfig } from "@/config";
import { userHasProjectAccess } from "@/lib/access";

const SHARE_LINK_VALIDITY_DAYS = 30;

function generateShareToken(): string {
  return randomBytes(18).toString("base64url"); // 24 URL-safe chars
}

function shareLinkExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SHARE_LINK_VALIDITY_DAYS);
  return d;
}

// ─── Create a share link for an item ────────────────────────────────────────

export async function createItemShareLinkAction(itemId: string): Promise<
  | { url: string; expiresAt: Date }
  | { error: string }
> {
  const user = await requireUser();

  // Load the item and its project in one join
  const row = await db
    .select({
      itemId: items.id,
      itemStatus: items.status,
      itemDeletedAt: items.deletedAt,
      projectId: projects.id,
      projectSlug: projects.slug,
      projectIsPublic: projects.isPublic,
      projectPublishStatus: projects.publishStatus,
      projectVisibility: projects.visibility,
      projectDeletedAt: projects.deletedAt,
    })
    .from(items)
    .innerJoin(projects, eq(items.projectId, projects.id))
    .where(eq(items.id, itemId))
    .limit(1);

  if (row.length === 0) return { error: "Item not found" };
  const data = row[0];

  if (data.itemDeletedAt || data.projectDeletedAt) return { error: "Item not found" };
  if (data.itemStatus === "hidden") return { error: "Item not found" };
  if (!data.projectIsPublic || data.projectPublishStatus !== "approved") {
    return { error: "Project is not publicly available" };
  }

  // Require the requesting user to have access (or own) the project
  const canShare = await userCanShareItem(user.id, data.projectId);
  if (!canShare) return { error: "Access denied" };

  const token = generateShareToken();
  const expiresAt = shareLinkExpiresAt();

  await db.insert(itemShareLinks).values({
    itemId,
    projectId: data.projectId,
    token,
    createdBy: user.id,
    expiresAt,
  });

  const url = `${siteConfig.url}/share/${token}`;
  return { url, expiresAt };
}

// ─── Revoke a share link ─────────────────────────────────────────────────────

export async function revokeItemShareLinkAction(
  linkId: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireUser();

  const link = await db.query.itemShareLinks.findFirst({
    where: eq(itemShareLinks.id, linkId),
  });
  if (!link) return { error: "Link not found" };

  // Creator can revoke; seller of the project can also revoke
  const canRevoke =
    link.createdBy === user.id ||
    (await isProjectSeller(user.id, link.projectId));

  if (!canRevoke) return { error: "Access denied" };
  if (link.revokedAt) return { error: "Link already revoked" };

  await db
    .update(itemShareLinks)
    .set({ revokedAt: new Date(), revokedBy: user.id })
    .where(eq(itemShareLinks.id, linkId));

  revalidatePath(`/seller/projects/${link.projectId}/share-links`);
  return { success: true };
}

// ─── Claim access via share link (called after auth on the share page) ───────

export async function claimShareLinkAction(token: string): Promise<
  | { projectSlug: string; itemId: string }
  | { error: "not_found" | "expired" | "revoked" }
> {
  const user = await requireUser();

  const link = await db.query.itemShareLinks.findFirst({
    where: eq(itemShareLinks.token, token),
  });

  if (!link) return { error: "not_found" };
  if (link.revokedAt) return { error: "revoked" };
  if (link.expiresAt < new Date()) return { error: "expired" };

  // Load project to get slug and visibility
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, link.projectId),
      eq(projects.isPublic, true),
      eq(projects.publishStatus, "approved"),
      isNull(projects.deletedAt)
    ),
    columns: { id: true, slug: true, visibility: true },
  });

  if (!project) return { error: "not_found" };

  // For invitation_only projects, grant access if not already granted
  if (project.visibility === "invitation_only") {
    const alreadyHasAccess = await userHasProjectAccess(user.id, project.id);
    if (!alreadyHasAccess) {
      // Upsert is not needed — unique constraint ensures one grant per (project, user).
      // If a revoked grant exists, we insert a fresh one.
      const existingRevoked = await db.query.projectAccessGrants.findFirst({
        where: and(
          eq(projectAccessGrants.projectId, project.id),
          eq(projectAccessGrants.userId, user.id),
          isNotNull(projectAccessGrants.revokedAt)
        ),
      });

      if (existingRevoked) {
        // Re-activate the existing revoked grant
        await db
          .update(projectAccessGrants)
          .set({ revokedAt: null, revokedBy: null, source: "share_link" })
          .where(eq(projectAccessGrants.id, existingRevoked.id));
      } else {
        await db.insert(projectAccessGrants).values({
          projectId: project.id,
          userId: user.id,
          source: "share_link",
        });
      }

      revalidatePath(`/project/${project.slug}`);
    }
  }

  return { projectSlug: project.slug, itemId: link.itemId };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isProjectSeller(userId: string, projectId: string): Promise<boolean> {
  const seller = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, userId),
    columns: { id: true },
  });
  if (!seller) return false;

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, seller.id),
      isNull(projects.deletedAt)
    ),
    columns: { id: true },
  });
  return !!project;
}

async function userCanShareItem(userId: string, projectId: string): Promise<boolean> {
  // Seller of the project can always share
  if (await isProjectSeller(userId, projectId)) return true;
  // Any authenticated user with active project access can share
  return userHasProjectAccess(userId, projectId);
}

// ─── Fetch share links for seller management page ────────────────────────────

export async function getProjectShareLinksAction(projectId: string): Promise<
  | Array<{
      id: string;
      token: string;
      itemId: string;
      itemTitle: string;
      createdByEmail: string;
      createdAt: Date;
      expiresAt: Date;
      revokedAt: Date | null;
      isExpired: boolean;
    }>
  | { error: string }
> {
  const user = await requireUser();
  const canManage = await isProjectSeller(user.id, projectId);
  if (!canManage) return { error: "Access denied" };

  const rows = await db
    .select({
      id: itemShareLinks.id,
      token: itemShareLinks.token,
      itemId: itemShareLinks.itemId,
      itemTitle: items.title,
      createdByEmail: profiles.email,
      createdAt: itemShareLinks.createdAt,
      expiresAt: itemShareLinks.expiresAt,
      revokedAt: itemShareLinks.revokedAt,
    })
    .from(itemShareLinks)
    .innerJoin(items, eq(itemShareLinks.itemId, items.id))
    .innerJoin(profiles, eq(itemShareLinks.createdBy, profiles.id))
    .where(eq(itemShareLinks.projectId, projectId))
    .orderBy(itemShareLinks.createdAt);

  const now = new Date();
  return rows.map((r) => ({
    ...r,
    isExpired: !r.revokedAt && r.expiresAt < now,
  }));
}
