import { db } from "@/db";
import { projects, sellerAccounts } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";

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
      eq(projects.sellerId, sellerAccountId),
      isNull(projects.deletedAt)
    ),
  });
}