import { NextResponse } from "next/server";
import { db } from "@/db";
import { conversationThreads, projects } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ unreadCount: 0, hasUnread: false });
  }

  if (user.role === "seller") {
    const sellerAccountIds = await getSellerAccountIdsForUser(user.id);

    if (sellerAccountIds.length === 0) {
      return NextResponse.json({ unreadCount: 0, hasUnread: false });
    }

    const sellerProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.sellerId, sellerAccountIds));

    const projectIds = sellerProjects.map((project) => project.id);

    if (projectIds.length === 0) {
      return NextResponse.json({ unreadCount: 0, hasUnread: false });
    }

    const threads = await db.query.conversationThreads.findMany({
      where: inArray(conversationThreads.projectId, projectIds),
      columns: {
        updatedAt: true,
        sellerLastReadAt: true,
      },
    });

    const unreadCount = threads.filter(
      (thread) =>
        !thread.sellerLastReadAt || thread.updatedAt > thread.sellerLastReadAt
    ).length;

    return NextResponse.json({ unreadCount, hasUnread: unreadCount > 0 });
  }

  const threads = await db.query.conversationThreads.findMany({
    where: eq(conversationThreads.buyerId, user.id),
    columns: {
      updatedAt: true,
      buyerLastReadAt: true,
    },
  });

  const unreadCount = threads.filter(
    (thread) =>
      !thread.buyerLastReadAt || thread.updatedAt > thread.buyerLastReadAt
  ).length;

  return NextResponse.json({ unreadCount, hasUnread: unreadCount > 0 });
}