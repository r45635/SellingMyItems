import { NextResponse } from "next/server";
import { db } from "@/db";
import { conversationThreads, projects } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

/**
 * Total unread = buyer-side unread + seller-side unread. The badge in
 * the nav must surface both — a user can simultaneously be a buyer on
 * someone's project AND a seller on their own. Filtering by role here
 * was the bug that made sellers miss buyer-side replies and vice-versa.
 */
export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({
      unreadCount: 0,
      hasUnread: false,
      buyerUnread: 0,
      sellerUnread: 0,
    });
  }

  const buyerThreads = await db.query.conversationThreads.findMany({
    where: eq(conversationThreads.buyerId, user.id),
    columns: { updatedAt: true, buyerLastReadAt: true },
  });
  const buyerUnread = buyerThreads.filter(
    (t) => !t.buyerLastReadAt || t.updatedAt > t.buyerLastReadAt
  ).length;

  let sellerUnread = 0;
  const sellerAccountIds = await getSellerAccountIdsForUser(user.id);
  if (sellerAccountIds.length > 0) {
    const sellerProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.sellerId, sellerAccountIds));
    const projectIds = sellerProjects.map((p) => p.id);

    if (projectIds.length > 0) {
      const sellerThreads = await db.query.conversationThreads.findMany({
        where: inArray(conversationThreads.projectId, projectIds),
        columns: { updatedAt: true, sellerLastReadAt: true },
      });
      sellerUnread = sellerThreads.filter(
        (t) => !t.sellerLastReadAt || t.updatedAt > t.sellerLastReadAt
      ).length;
    }
  }

  const unreadCount = buyerUnread + sellerUnread;

  return NextResponse.json({
    unreadCount,
    hasUnread: unreadCount > 0,
    buyerUnread,
    sellerUnread,
  });
}
