import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  buyerIntentItems,
  buyerWishlistItems,
  buyerWishlists,
  items,
  sellerAccounts,
} from "@/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";
import { findSellerProject } from "@/lib/seller-accounts";
import { toCsv } from "@/lib/csv";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireSeller();
  const { projectId } = await params;

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  if (!sellerAccount) return new Response("Unauthorized", { status: 401 });

  const project = await findSellerProject(sellerAccount.id, projectId);
  if (!project) return new Response("Not found", { status: 404 });

  const [projectItems, wishlistCounts, intentCounts] = await Promise.all([
    db
      .select({
        id: items.id,
        title: items.title,
        status: items.status,
        price: items.price,
        currency: items.currency,
        viewCount: items.viewCount,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(and(eq(items.projectId, project.id), isNull(items.deletedAt))),

    db
      .select({ itemId: buyerWishlistItems.itemId, cnt: count() })
      .from(buyerWishlistItems)
      .innerJoin(
        buyerWishlists,
        eq(buyerWishlistItems.wishlistId, buyerWishlists.id)
      )
      .where(eq(buyerWishlists.projectId, project.id))
      .groupBy(buyerWishlistItems.itemId),

    db
      .select({ itemId: buyerIntentItems.itemId, cnt: count() })
      .from(buyerIntentItems)
      .innerJoin(items, eq(buyerIntentItems.itemId, items.id))
      .where(and(eq(items.projectId, project.id), isNull(items.deletedAt)))
      .groupBy(buyerIntentItems.itemId),
  ]);

  const wishlistMap = new Map(wishlistCounts.map((r) => [r.itemId, r.cnt]));
  const intentMap = new Map(intentCounts.map((r) => [r.itemId, r.cnt]));

  const rows = projectItems.map((item) => ({
    name: item.title,
    status: item.status,
    price: item.price ?? "",
    currency: item.currency,
    viewCount: item.viewCount,
    wishlists: wishlistMap.get(item.id) ?? 0,
    intents: intentMap.get(item.id) ?? 0,
    createdAt: item.createdAt.toISOString(),
  }));

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="items-${project.slug}.csv"`,
    },
  });
}
