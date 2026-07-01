import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  items,
  profiles,
  projects,
} from "@/db/schema";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
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
  if (!projectIds.length) {
    return new Response("name,status\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="intents.csv"',
      },
    });
  }

  const projectSlugMap = new Map(sellerProjects.map((p) => [p.id, p.slug]));

  const intents = await db
    .select({
      id: buyerIntents.id,
      userId: buyerIntents.userId,
      projectId: buyerIntents.projectId,
      status: buyerIntents.status,
      reviewerNote: buyerIntents.reviewerNote,
      createdAt: buyerIntents.createdAt,
      reviewedAt: buyerIntents.updatedAt,
    })
    .from(buyerIntents)
    .where(inArray(buyerIntents.projectId, projectIds))
    .orderBy(desc(buyerIntents.createdAt));

  const buyerIds = [...new Set(intents.map((i) => i.userId))];
  const buyers =
    buyerIds.length > 0
      ? await db
          .select({ id: profiles.id, displayName: profiles.displayName, email: profiles.email })
          .from(profiles)
          .where(inArray(profiles.id, buyerIds))
      : [];
  const buyerMap = new Map(buyers.map((b) => [b.id, b]));

  // Item count per intent
  const intentIds = intents.map((i) => i.id);
  const itemCounts =
    intentIds.length > 0
      ? await db
          .select({ intentId: buyerIntentItems.intentId, cnt: count() })
          .from(buyerIntentItems)
          .where(inArray(buyerIntentItems.intentId, intentIds))
          .groupBy(buyerIntentItems.intentId)
      : [];
  const itemCountMap = new Map(itemCounts.map((r) => [r.intentId, r.cnt]));

  // Item titles per intent (first 3 joined)
  const intentItemRows =
    intentIds.length > 0
      ? await db
          .select({
            intentId: buyerIntentItems.intentId,
            title: items.title,
          })
          .from(buyerIntentItems)
          .innerJoin(items, eq(buyerIntentItems.itemId, items.id))
          .where(inArray(buyerIntentItems.intentId, intentIds))
      : [];
  const intentItemsMap = new Map<string, string[]>();
  for (const row of intentItemRows) {
    if (!intentItemsMap.has(row.intentId)) intentItemsMap.set(row.intentId, []);
    intentItemsMap.get(row.intentId)!.push(row.title);
  }

  const rows = intents.map((intent) => {
    const buyer = buyerMap.get(intent.userId);
    const itemTitles = intentItemsMap.get(intent.id) ?? [];
    return {
      projectSlug: projectSlugMap.get(intent.projectId) ?? "",
      buyerDisplayName: buyer?.displayName ?? "",
      buyerEmail: buyer?.email ?? "",
      itemsCount: itemCountMap.get(intent.id) ?? 0,
      items: itemTitles.slice(0, 3).join(" | "),
      status: intent.status,
      createdAt: intent.createdAt.toISOString(),
      reviewedAt: intent.reviewedAt?.toISOString() ?? "",
      reviewerNote: intent.reviewerNote ?? "",
    };
  });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="intents.csv"',
    },
  });
}
