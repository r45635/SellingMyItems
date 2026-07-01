import { db } from "@/db";
import { projectCollaborators, projects, sellerAccounts } from "@/db/schema";
import { and, asc, eq, exists, isNull, or } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getSellerAccountIdsForUser(userId: string) {
  const rows = await db
    .select({ id: sellerAccounts.id })
    .from(sellerAccounts)
    .where(eq(sellerAccounts.userId, userId))
    .orderBy(asc(sellerAccounts.createdAt));

  return rows.map((row) => row.id);
}

/**
 * Find a seller-owned project by UUID or slug.
 * Returns the project or null if not found / not owned.
 */
export async function findSellerProject(
  sellerAccountId: string,
  projectIdOrSlug: string
) {
  const idCondition = UUID_RE.test(projectIdOrSlug)
    ? or(eq(projects.id, projectIdOrSlug), eq(projects.slug, projectIdOrSlug))
    : eq(projects.slug, projectIdOrSlug);

  return db.query.projects.findFirst({
    where: and(
      idCondition,
      isNull(projects.deletedAt),
      or(
        eq(projects.sellerId, sellerAccountId),
        exists(
          db
            .select({ id: projectCollaborators.id })
            .from(projectCollaborators)
            .where(
              and(
                eq(projectCollaborators.projectId, projects.id),
                eq(projectCollaborators.sellerAccountId, sellerAccountId)
              )
            )
        )
      )
    ),
  });
}

/**
 * Check if a seller account is the primary owner of a project.
 * Collaborators are NOT considered owners.
 */
export async function isProjectOwner(
  sellerAccountId: string,
  projectId: string
): Promise<boolean> {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccountId),
      isNull(projects.deletedAt)
    ),
    columns: { id: true },
  });
  return project != null;
}