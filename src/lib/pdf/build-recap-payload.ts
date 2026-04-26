import { db } from "@/db";
import {
  itemImages,
  items,
  profiles,
  sellerAccounts,
} from "@/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { PdfItem, PdfPayload } from "./project-recap-pdf";

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  cityArea: string;
  description: string | null;
  sellerId: string;
};

type Options = {
  /** Specific item IDs the seller selected. Empty / undefined means "all". */
  itemIds?: string[];
  /** Optional subtitle, e.g. "Reservation for Nathalie". */
  subtitle?: string;
  /** Locale for currency / date formatting. */
  locale: string;
};

/**
 * Pull every piece of data the project-recap PDF needs in a few queries.
 * Caller is expected to have already authorized the seller.
 */
export async function buildRecapPayload(
  project: ProjectRow,
  options: Options
): Promise<PdfPayload> {
  // Resolve the seller's display info to print on the cover.
  const sellerRow = await db
    .select({
      displayName: profiles.displayName,
      email: profiles.email,
    })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(eq(sellerAccounts.id, project.sellerId))
    .limit(1);
  const seller = sellerRow[0];
  const sellerName = seller?.displayName || seller?.email || "Seller";

  // Pull items, optionally filtered to the requested IDs.
  const baseConditions = [
    eq(items.projectId, project.id),
    isNull(items.deletedAt),
  ];
  if (options.itemIds && options.itemIds.length > 0) {
    baseConditions.push(inArray(items.id, options.itemIds));
  }
  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      brand: items.brand,
      description: items.description,
      condition: items.condition,
      approximateAge: items.approximateAge,
      price: items.price,
      originalPrice: items.originalPrice,
      currency: items.currency,
      notes: items.notes,
      status: items.status,
      coverImageUrl: items.coverImageUrl,
      reservedForUserId: items.reservedForUserId,
      soldToUserId: items.soldToUserId,
      sortOrder: items.sortOrder,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(and(...baseConditions))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));

  // Resolve gallery images per item.
  const itemIds = rows.map((r) => r.id);
  const allImages =
    itemIds.length > 0
      ? await db
          .select({
            itemId: itemImages.itemId,
            url: itemImages.url,
            altText: itemImages.altText,
            sortOrder: itemImages.sortOrder,
          })
          .from(itemImages)
          .where(inArray(itemImages.itemId, itemIds))
          .orderBy(asc(itemImages.sortOrder))
      : [];
  const imagesByItem = new Map<string, { url: string; altText: string | null }[]>();
  for (const img of allImages) {
    const list = imagesByItem.get(img.itemId) ?? [];
    list.push({ url: img.url, altText: img.altText });
    imagesByItem.set(img.itemId, list);
  }

  // Resolve buyer display names (reserved / sold) for the badge on each card.
  const buyerIds = new Set<string>();
  for (const r of rows) {
    if (r.reservedForUserId) buyerIds.add(r.reservedForUserId);
    if (r.soldToUserId) buyerIds.add(r.soldToUserId);
  }
  const buyerRows =
    buyerIds.size > 0
      ? await db
          .select({
            id: profiles.id,
            displayName: profiles.displayName,
            email: profiles.email,
          })
          .from(profiles)
          .where(inArray(profiles.id, Array.from(buyerIds)))
      : [];
  const buyerLabel = new Map(
    buyerRows.map((b) => [
      b.id,
      b.displayName || b.email || "Unknown",
    ])
  );

  const pdfItems: PdfItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    brand: r.brand,
    description: r.description,
    condition: r.condition,
    approximateAge: r.approximateAge,
    price: r.price,
    originalPrice: r.originalPrice,
    currency: r.currency,
    notes: r.notes,
    status: r.status,
    coverImageUrl: r.coverImageUrl,
    images: imagesByItem.get(r.id) ?? [],
    reservedForLabel: r.reservedForUserId
      ? (buyerLabel.get(r.reservedForUserId) ?? null)
      : null,
    soldToLabel: r.soldToUserId
      ? (buyerLabel.get(r.soldToUserId) ?? null)
      : null,
  }));

  return {
    project: {
      name: project.name,
      cityArea: project.cityArea,
      description: project.description,
      sellerName,
      sellerEmail: seller?.email ?? null,
    },
    items: pdfItems,
    generatedAt: new Date(),
    locale: options.locale,
    subtitle: options.subtitle,
  };
}

/** Suggested filename for the downloaded PDF. */
export function recapPdfFilename(slug: string, suffix?: string) {
  const date = new Date().toISOString().slice(0, 10);
  const tag = suffix ? `-${suffix}` : "";
  return `${slug}-recap${tag}-${date}.pdf`;
}
