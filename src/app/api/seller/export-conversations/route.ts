import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
} from "@/db/schema";
import { and, count, desc, inArray, isNull } from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const user = await requireSeller();

  const sellerAccountIds = await getSellerAccountIdsForUser(user.id);
  if (!sellerAccountIds.length) return new Response("", { status: 200 });

  const sellerProjects = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(
      and(
        inArray(projects.sellerId, sellerAccountIds),
        isNull(projects.deletedAt)
      )
    );

  const projectIds = sellerProjects.map((p) => p.id);
  const projectSlugMap = new Map(sellerProjects.map((p) => [p.id, p.slug]));

  if (!projectIds.length) {
    return new Response("projectSlug,buyer,lastMessageAt,messageCount,lastMessageSnippet\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="conversations.csv"',
      },
    });
  }

  const threads = await db
    .select({
      id: conversationThreads.id,
      projectId: conversationThreads.projectId,
      buyerId: conversationThreads.buyerId,
      updatedAt: conversationThreads.updatedAt,
    })
    .from(conversationThreads)
    .where(inArray(conversationThreads.projectId, projectIds))
    .orderBy(desc(conversationThreads.updatedAt));

  const buyerIds = [...new Set(threads.map((t) => t.buyerId))];
  const buyers =
    buyerIds.length > 0
      ? await db
          .select({ id: profiles.id, displayName: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.id, buyerIds))
      : [];
  const buyerMap = new Map(buyers.map((b) => [b.id, b.displayName ?? ""]));

  const threadIds = threads.map((t) => t.id);
  const [msgCounts, lastMsgs] =
    threadIds.length > 0
      ? await Promise.all([
          db
            .select({ threadId: conversationMessages.threadId, cnt: count() })
            .from(conversationMessages)
            .where(inArray(conversationMessages.threadId, threadIds))
            .groupBy(conversationMessages.threadId),
          db
            .select({
              threadId: conversationMessages.threadId,
              body: conversationMessages.body,
              createdAt: conversationMessages.createdAt,
            })
            .from(conversationMessages)
            .where(inArray(conversationMessages.threadId, threadIds))
            .orderBy(desc(conversationMessages.createdAt)),
        ])
      : [[], []];

  const countMap = new Map(msgCounts.map((r) => [r.threadId, r.cnt]));
  const lastMsgMap = new Map<string, { body: string; createdAt: Date }>();
  for (const msg of lastMsgs) {
    if (!lastMsgMap.has(msg.threadId)) {
      lastMsgMap.set(msg.threadId, { body: msg.body, createdAt: msg.createdAt });
    }
  }

  const rows = threads.map((thread) => {
    const last = lastMsgMap.get(thread.id);
    const snippet = last ? last.body.slice(0, 80) : "";
    return {
      projectSlug: projectSlugMap.get(thread.projectId) ?? "",
      buyer: buyerMap.get(thread.buyerId) ?? "",
      lastMessageAt: (last?.createdAt ?? thread.updatedAt).toISOString(),
      messageCount: countMap.get(thread.id) ?? 0,
      lastMessageSnippet: snippet,
    };
  });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="conversations.csv"',
    },
  });
}
