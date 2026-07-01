"use server";

import { db } from "@/db";
import { profiles, projectCollaborators, sellerAccounts } from "@/db/schema";
import { requireSeller } from "@/lib/auth";
import { getSellerAccountIdsForUser, isProjectOwner } from "@/lib/seller-accounts";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function inviteCoSellerAction(projectId: string, email: string) {
  const user = await requireSeller();
  const [sellerAccountId] = await getSellerAccountIdsForUser(user.id);
  if (!sellerAccountId) return { error: "no_seller_account" };

  const isOwner = await isProjectOwner(sellerAccountId, projectId);
  if (!isOwner) return { error: "not_owner" };

  // Resolve invitee profile by email
  const inviteeProfile = await db.query.profiles.findFirst({
    where: eq(profiles.email, email.toLowerCase().trim()),
    columns: { id: true },
  });
  if (!inviteeProfile) return { error: "user_not_found" };
  if (inviteeProfile.id === user.id) return { error: "cannot_invite_self" };

  // Resolve invitee seller account
  const inviteeSeller = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, inviteeProfile.id),
    columns: { id: true },
  });
  if (!inviteeSeller) return { error: "not_a_seller" };

  // Check not already a collaborator
  const existing = await db.query.projectCollaborators.findFirst({
    where: and(
      eq(projectCollaborators.projectId, projectId),
      eq(projectCollaborators.sellerAccountId, inviteeSeller.id)
    ),
    columns: { id: true },
  });
  if (existing) return { error: "already_collaborator" };

  await db.insert(projectCollaborators).values({
    projectId,
    sellerAccountId: inviteeSeller.id,
    invitedBy: sellerAccountId,
  });

  revalidatePath(`/seller/projects/${projectId}/edit`);
  return { success: true };
}

export async function removeCoSellerAction(
  projectId: string,
  coSellerAccountId: string
) {
  const user = await requireSeller();
  const [sellerAccountId] = await getSellerAccountIdsForUser(user.id);
  if (!sellerAccountId) return { error: "no_seller_account" };

  const isOwner = await isProjectOwner(sellerAccountId, projectId);
  if (!isOwner) return { error: "not_owner" };

  await db
    .delete(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.sellerAccountId, coSellerAccountId)
      )
    );

  revalidatePath(`/seller/projects/${projectId}/edit`);
  return { success: true };
}
