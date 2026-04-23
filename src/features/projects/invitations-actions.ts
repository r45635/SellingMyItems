"use server";

import { requireSeller, requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  projects,
  sellerAccounts,
  profiles,
  projectInvitations,
  projectAccessGrants,
  projectAccessRequests,
} from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  generateInvitationCode,
  computeExpiryDate,
  isValidityDays,
  findUsableInvitation,
  userHasProjectAccess,
  type InvitationValidityDays,
} from "@/lib/access";
import {
  sendInvitationEmail,
  sendAccessGrantedEmail,
  sendAccessDeclinedEmail,
  sendAccessRevokedEmail,
  sendAccessRequestedEmail,
} from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { siteConfig } from "@/config";

// ─── Seller helpers ─────────────────────────────────────────────────────────

async function getOwnedProject(userId: string, projectId: string) {
  const seller = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, userId),
  });
  if (!seller) return null;

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, seller.id),
      isNull(projects.deletedAt)
    ),
  });
  return project ?? null;
}

function projectUrl(slug: string, locale = "en") {
  return `${siteConfig.url}/${locale}/project/${slug}`;
}

function sellerManageUrl(projectId: string) {
  return `${siteConfig.url}/seller/projects/${projectId}/access`;
}

// ─── Set visibility (toggle public ↔ invitation_only) ───────────────────────

export async function setProjectVisibilityAction(
  projectId: string,
  visibility: "public" | "invitation_only"
) {
  const user = await requireSeller();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };

  if (project.visibility === visibility) {
    return { success: true };
  }

  // On ANY transition between public/invitation_only: wipe invitation-system rows.
  // Buyer-side data (wishlists, messages, intents) is preserved.
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await tx
      .delete(projectInvitations)
      .where(eq(projectInvitations.projectId, projectId));

    await tx
      .delete(projectAccessRequests)
      .where(eq(projectAccessRequests.projectId, projectId));

    await tx
      .delete(projectAccessGrants)
      .where(eq(projectAccessGrants.projectId, projectId));
  });

  revalidatePath(`/seller/projects/${projectId}/access`);
  revalidatePath(`/seller/projects/${projectId}`);
  revalidatePath(`/project/${project.slug}`);
  return { success: true };
}

// ─── Create a targeted invitation (email-specific) ──────────────────────────

export async function createTargetedInvitationAction(formData: FormData) {
  const user = await requireSeller();
  const projectId = String(formData.get("projectId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const daysRaw = Number(formData.get("validityDays"));
  const locale = String(formData.get("locale") ?? "en");

  if (!email.includes("@")) return { error: "Invalid email" };
  if (!isValidityDays(daysRaw)) return { error: "Invalid validity" };

  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };
  if (project.visibility !== "invitation_only") {
    return { error: "Project is not invitation-only" };
  }

  // Revoke any existing active targeted invitation for this email+project
  await db
    .update(projectInvitations)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.email, email),
        eq(projectInvitations.status, "active")
      )
    );

  const code = generateInvitationCode();
  const expiresAt = computeExpiryDate(daysRaw as InvitationValidityDays);

  const [inserted] = await db
    .insert(projectInvitations)
    .values({
      projectId,
      email,
      code,
      expiresAt,
      createdBy: user.id,
    })
    .returning({ id: projectInvitations.id });

  // Fetch seller display name
  const sellerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { displayName: true, email: true },
  });

  // Send email
  await sendInvitationEmail(email, {
    projectName: project.name,
    sellerName: sellerProfile?.displayName ?? sellerProfile?.email ?? "The seller",
    code,
    projectUrl: projectUrl(project.slug, locale),
    expiresAt,
    isTargeted: true,
    locale,
  });

  // If the email already corresponds to a user, create an in-app notification
  const invitee = await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
    columns: { id: true },
  });
  if (invitee) {
    await createNotification({
      userId: invitee.id,
      type: "invitation_received",
      title: `Invitation pour ${project.name}`,
      body: `Code : ${code}`,
      linkUrl: `/project/${project.slug}`,
      projectId: project.id,
    });
  }

  revalidatePath(`/seller/projects/${projectId}/access`);
  return { success: true, invitationId: inserted.id };
}

// ─── Generate or regenerate the generic code for a project ──────────────────

export async function generateGenericCodeAction(formData: FormData) {
  const user = await requireSeller();
  const projectId = String(formData.get("projectId") ?? "");
  const daysRaw = Number(formData.get("validityDays"));

  if (!isValidityDays(daysRaw)) return { error: "Invalid validity" };

  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };
  if (project.visibility !== "invitation_only") {
    return { error: "Project is not invitation-only" };
  }

  // Revoke existing active generic code (email IS NULL)
  await db
    .update(projectInvitations)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(projectInvitations.projectId, projectId),
        isNull(projectInvitations.email),
        eq(projectInvitations.status, "active")
      )
    );

  const code = generateInvitationCode();
  const expiresAt = computeExpiryDate(daysRaw as InvitationValidityDays);

  await db.insert(projectInvitations).values({
    projectId,
    email: null,
    code,
    expiresAt,
    createdBy: user.id,
  });

  revalidatePath(`/seller/projects/${projectId}/access`);
  return { success: true, code };
}

// ─── Revoke a single invitation (targeted or generic) ──────────────────────

export async function revokeInvitationAction(
  invitationId: string,
  projectId: string
) {
  const user = await requireSeller();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };

  await db
    .update(projectInvitations)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(projectInvitations.id, invitationId),
        eq(projectInvitations.projectId, projectId)
      )
    );

  revalidatePath(`/seller/projects/${projectId}/access`);
  return { success: true };
}

// ─── Buyer: enter code ──────────────────────────────────────────────────────
// If targeted to the user's email → auto grant.
// Otherwise (generic or targeted-to-other) → create pending request.

export async function redeemInvitationCodeAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const message = String(formData.get("message") ?? "").trim().slice(0, 500);
  const locale = String(formData.get("locale") ?? "en");

  if (!code) return { error: "Code required" };

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
  });
  if (!project) return { error: "Project not found" };
  if (project.visibility !== "invitation_only") {
    return { error: "Project is not invitation-only" };
  }

  // Already has access?
  if (await userHasProjectAccess(user.id, projectId)) {
    return { success: true, status: "already_granted" as const };
  }

  const invitation = await findUsableInvitation(code);

  if (!invitation || invitation.projectId !== projectId) {
    return { error: "invalid_or_expired" };
  }

  const userEmail = (
    await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: { email: true, displayName: true },
    })
  );
  const userEmailLower = userEmail?.email?.toLowerCase() ?? "";

  // Case 1: Targeted invitation matching this user's email → auto-grant
  if (invitation.email && invitation.email.toLowerCase() === userEmailLower) {
    await db.transaction(async (tx) => {
      await tx
        .insert(projectAccessGrants)
        .values({
          projectId,
          userId: user.id,
          source: "targeted_invitation",
          invitationId: invitation.id,
        })
        .onConflictDoNothing();

      await tx
        .update(projectInvitations)
        .set({
          status: "used",
          usedByUserId: user.id,
          usedAt: new Date(),
        })
        .where(eq(projectInvitations.id, invitation.id));
    });

    await createNotification({
      userId: user.id,
      type: "access_granted",
      title: `Accès accordé — ${project.name}`,
      linkUrl: `/project/${project.slug}`,
      projectId: project.id,
    });

    revalidatePath(`/project/${project.slug}`);
    return { success: true, status: "granted" as const };
  }

  // Case 2: Generic code (email is null) OR targeted to another email → pending request
  if (invitation.email && invitation.email.toLowerCase() !== userEmailLower) {
    return { error: "code_for_another_user" };
  }

  // Check for existing pending request
  const existing = await db.query.projectAccessRequests.findFirst({
    where: and(
      eq(projectAccessRequests.projectId, projectId),
      eq(projectAccessRequests.userId, user.id),
      eq(projectAccessRequests.status, "pending")
    ),
  });
  if (existing) {
    return { success: true, status: "already_pending" as const };
  }

  await db.insert(projectAccessRequests).values({
    projectId,
    userId: user.id,
    invitationId: invitation.id,
    codeUsed: code,
    message: message || null,
  });

  // Notify seller
  const seller = await db
    .select({ userId: sellerAccounts.userId })
    .from(sellerAccounts)
    .where(eq(sellerAccounts.id, project.sellerId))
    .limit(1);
  const sellerUserId = seller[0]?.userId;
  if (sellerUserId) {
    const sellerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, sellerUserId),
      columns: { email: true },
    });

    await createNotification({
      userId: sellerUserId,
      type: "access_requested",
      title: `Demande d'accès — ${project.name}`,
      body: `${userEmail?.displayName ?? userEmail?.email ?? "Un acheteur"} demande l'accès`,
      linkUrl: `/seller/projects/${project.id}/access`,
      projectId: project.id,
    });

    if (sellerProfile?.email) {
      await sendAccessRequestedEmail(sellerProfile.email, {
        buyerName: userEmail?.displayName ?? userEmail?.email ?? "A buyer",
        buyerEmail: userEmail?.email ?? "",
        projectName: project.name,
        manageUrl: sellerManageUrl(project.id),
        locale,
      });
    }
  }

  revalidatePath(`/project/${project.slug}`);
  return { success: true, status: "pending" as const };
}

// ─── Buyer: request access without a code (or after code expired) ──────────

export async function requestAccessWithoutCodeAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 500);
  const locale = String(formData.get("locale") ?? "en");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
  });
  if (!project) return { error: "Project not found" };
  if (project.visibility !== "invitation_only") {
    return { error: "Project is not invitation-only" };
  }

  if (await userHasProjectAccess(user.id, projectId)) {
    return { success: true, status: "already_granted" as const };
  }

  const existing = await db.query.projectAccessRequests.findFirst({
    where: and(
      eq(projectAccessRequests.projectId, projectId),
      eq(projectAccessRequests.userId, user.id),
      eq(projectAccessRequests.status, "pending")
    ),
  });
  if (existing) {
    return { success: true, status: "already_pending" as const };
  }

  await db.insert(projectAccessRequests).values({
    projectId,
    userId: user.id,
    message: message || null,
  });

  // Notify seller
  const seller = await db
    .select({ userId: sellerAccounts.userId })
    .from(sellerAccounts)
    .where(eq(sellerAccounts.id, project.sellerId))
    .limit(1);
  const sellerUserId = seller[0]?.userId;
  const userProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { email: true, displayName: true },
  });
  if (sellerUserId) {
    const sellerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, sellerUserId),
      columns: { email: true },
    });
    await createNotification({
      userId: sellerUserId,
      type: "access_requested",
      title: `Demande d'accès — ${project.name}`,
      body: `${userProfile?.displayName ?? userProfile?.email ?? "Un acheteur"} demande l'accès`,
      linkUrl: `/seller/projects/${project.id}/access`,
      projectId: project.id,
    });
    if (sellerProfile?.email) {
      await sendAccessRequestedEmail(sellerProfile.email, {
        buyerName: userProfile?.displayName ?? userProfile?.email ?? "A buyer",
        buyerEmail: userProfile?.email ?? "",
        projectName: project.name,
        manageUrl: sellerManageUrl(project.id),
        locale,
      });
    }
  }

  revalidatePath(`/project/${project.slug}`);
  return { success: true, status: "pending" as const };
}

// ─── Seller: approve a pending request ─────────────────────────────────────

export async function approveAccessRequestAction(
  requestId: string,
  projectId: string,
  locale = "en"
) {
  const user = await requireSeller();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };

  const request = await db.query.projectAccessRequests.findFirst({
    where: and(
      eq(projectAccessRequests.id, requestId),
      eq(projectAccessRequests.projectId, projectId),
      eq(projectAccessRequests.status, "pending")
    ),
  });
  if (!request) return { error: "Request not found" };

  await db.transaction(async (tx) => {
    await tx
      .update(projectAccessRequests)
      .set({
        status: "approved",
        respondedBy: user.id,
        respondedAt: new Date(),
      })
      .where(eq(projectAccessRequests.id, requestId));

    await tx
      .insert(projectAccessGrants)
      .values({
        projectId,
        userId: request.userId,
        source: request.invitationId ? "generic_request" : "seller_manual",
        invitationId: request.invitationId,
      })
      .onConflictDoNothing();
  });

  const buyerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, request.userId),
    columns: { email: true },
  });
  await createNotification({
    userId: request.userId,
    type: "access_granted",
    title: `Accès accordé — ${project.name}`,
    linkUrl: `/project/${project.slug}`,
    projectId: project.id,
  });
  if (buyerProfile?.email) {
    await sendAccessGrantedEmail(buyerProfile.email, {
      projectName: project.name,
      projectUrl: projectUrl(project.slug, locale),
      locale,
    });
  }

  revalidatePath(`/seller/projects/${projectId}/access`);
  return { success: true };
}

// ─── Seller: decline a pending request ─────────────────────────────────────

export async function declineAccessRequestAction(
  requestId: string,
  projectId: string,
  locale = "en"
) {
  const user = await requireSeller();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };

  const request = await db.query.projectAccessRequests.findFirst({
    where: and(
      eq(projectAccessRequests.id, requestId),
      eq(projectAccessRequests.projectId, projectId),
      eq(projectAccessRequests.status, "pending")
    ),
  });
  if (!request) return { error: "Request not found" };

  await db
    .update(projectAccessRequests)
    .set({
      status: "declined",
      respondedBy: user.id,
      respondedAt: new Date(),
    })
    .where(eq(projectAccessRequests.id, requestId));

  const buyerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, request.userId),
    columns: { email: true },
  });
  await createNotification({
    userId: request.userId,
    type: "access_declined",
    title: `Demande refusée — ${project.name}`,
    projectId: project.id,
  });
  if (buyerProfile?.email) {
    await sendAccessDeclinedEmail(buyerProfile.email, {
      projectName: project.name,
      locale,
    });
  }

  revalidatePath(`/seller/projects/${projectId}/access`);
  return { success: true };
}

// ─── Seller: revoke an existing access grant ───────────────────────────────

export async function revokeAccessGrantAction(
  grantId: string,
  projectId: string,
  locale = "en"
) {
  const user = await requireSeller();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return { error: "Project not found" };

  const grant = await db.query.projectAccessGrants.findFirst({
    where: and(
      eq(projectAccessGrants.id, grantId),
      eq(projectAccessGrants.projectId, projectId),
      isNull(projectAccessGrants.revokedAt)
    ),
  });
  if (!grant) return { error: "Grant not found" };

  // Hard-delete the grant so the unique (project_id, user_id) index allows
  // future re-granting without collision.
  await db.delete(projectAccessGrants).where(eq(projectAccessGrants.id, grantId));

  const buyerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, grant.userId),
    columns: { email: true },
  });
  await createNotification({
    userId: grant.userId,
    type: "access_revoked",
    title: `Accès retiré — ${project.name}`,
    projectId: project.id,
  });
  if (buyerProfile?.email) {
    await sendAccessRevokedEmail(buyerProfile.email, {
      projectName: project.name,
      locale,
    });
  }

  revalidatePath(`/seller/projects/${projectId}/access`);
  return { success: true };
}

// ─── Buyer: decline / cancel their own pending request or invitation ───────

export async function cancelOwnAccessRequestAction(requestId: string) {
  const user = await requireUser();

  const request = await db.query.projectAccessRequests.findFirst({
    where: and(
      eq(projectAccessRequests.id, requestId),
      eq(projectAccessRequests.userId, user.id),
      eq(projectAccessRequests.status, "pending")
    ),
  });
  if (!request) return { error: "Request not found" };

  await db
    .update(projectAccessRequests)
    .set({
      status: "cancelled",
      respondedAt: new Date(),
    })
    .where(eq(projectAccessRequests.id, requestId));

  revalidatePath("/my-projects");
  return { success: true };
}

// ─── Seller: list invitations + requests + grants for a project ────────────

export async function getProjectAccessData(projectId: string) {
  const user = await requireSeller();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return null;

  const [invitations, requests, grants] = await Promise.all([
    db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, projectId))
      .orderBy(desc(projectInvitations.createdAt)),
    db
      .select({
        id: projectAccessRequests.id,
        userId: projectAccessRequests.userId,
        status: projectAccessRequests.status,
        message: projectAccessRequests.message,
        codeUsed: projectAccessRequests.codeUsed,
        createdAt: projectAccessRequests.createdAt,
        respondedAt: projectAccessRequests.respondedAt,
        email: profiles.email,
        displayName: profiles.displayName,
      })
      .from(projectAccessRequests)
      .innerJoin(profiles, eq(projectAccessRequests.userId, profiles.id))
      .where(eq(projectAccessRequests.projectId, projectId))
      .orderBy(desc(projectAccessRequests.createdAt)),
    db
      .select({
        id: projectAccessGrants.id,
        userId: projectAccessGrants.userId,
        source: projectAccessGrants.source,
        grantedAt: projectAccessGrants.grantedAt,
        email: profiles.email,
        displayName: profiles.displayName,
      })
      .from(projectAccessGrants)
      .innerJoin(profiles, eq(projectAccessGrants.userId, profiles.id))
      .where(
        and(
          eq(projectAccessGrants.projectId, projectId),
          isNull(projectAccessGrants.revokedAt)
        )
      )
      .orderBy(desc(projectAccessGrants.grantedAt)),
  ]);

  return { project, invitations, requests, grants };
}
