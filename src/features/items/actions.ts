"use server";

import { requireSeller } from "@/lib/auth";
import { itemFormSchema, ITEM_STATUSES } from "@/lib/validations";
import { db } from "@/db";
import { items, itemImages, itemLinks, profiles, sellerAccounts, projects, buyerIntents, conversationThreads, conversationMessages } from "@/db/schema";
import { and, eq, isNull, inArray, notInArray, ilike } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findSellerProject } from "@/lib/seller-accounts";
import { siteConfig } from "@/config";

function revalidateSellerItemsPaths(projectIdOrSlug: string) {
  // Revalidate both the unlocalized path and every localized variant so the
  // browser's currently-rendered page (which lives under /en/... or /fr/...)
  // picks up the fresh server data. Without the locale-prefixed path the
  // rendered cache is stale and the client sees an unchanged UI.
  revalidatePath(`/seller/projects/${projectIdOrSlug}/items`);
  for (const locale of siteConfig.locales) {
    revalidatePath(`/${locale}/seller/projects/${projectIdOrSlug}/items`);
  }
}

function revalidateReservationsPaths(projectIdOrSlug: string) {
  revalidatePath(`/seller/projects/${projectIdOrSlug}/reservations`);
  for (const locale of siteConfig.locales) {
    revalidatePath(`/${locale}/seller/projects/${projectIdOrSlug}/reservations`);
    revalidatePath(`/${locale}/reservations`);
  }
  revalidatePath(`/reservations`);
}

async function getSellerAccountId(user: { id: string; email: string }) {
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  return sellerAccount?.id ?? null;
}

export async function createItemAction(formData: FormData) {
  const user = await requireSeller();
  const projectId = formData.get("projectId") as string;

  const rawData = {
    title: formData.get("title"),
    brand: formData.get("brand") || undefined,
    description: formData.get("description") || undefined,
    condition: formData.get("condition") || undefined,
    approximateAge: formData.get("approximateAge") || undefined,
    price: formData.get("price") ? Number(formData.get("price")) : undefined,
    originalPrice: formData.get("originalPrice") ? Number(formData.get("originalPrice")) : undefined,
    currency: formData.get("currency") || "USD",
    notes: formData.get("notes") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    status: formData.get("status") || "available",
  };

  const validated = itemFormSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: { form: ["Seller account not found"] } };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: { form: ["Project not found or unauthorized"] } };
  }

  const [createdItem] = await db.insert(items).values({
    projectId: ownedProject.id,
    title: validated.data.title,
    brand: validated.data.brand,
    description: validated.data.description,
    condition: validated.data.condition,
    approximateAge: validated.data.approximateAge,
    price: validated.data.price,
    originalPrice: validated.data.originalPrice,
    currency: validated.data.currency,
    notes: validated.data.notes,
    categoryId: validated.data.categoryId,
    status: validated.data.status,
  }).returning();

  // Save image URLs
  const imageUrlValues = formData.getAll("imageUrl").map(String).filter(Boolean);
  const imageHdUrlValues = formData.getAll("imageHdUrl").map(String);
  if (imageUrlValues.length > 0) {
    await db.insert(itemImages).values(
      imageUrlValues.map((url, idx) => ({
        itemId: createdItem.id,
        url,
        hdUrl: imageHdUrlValues[idx] || null,
        sortOrder: idx,
      }))
    );
    // Set first image as cover
    await db
      .update(items)
      .set({ coverImageUrl: imageUrlValues[0] })
      .where(eq(items.id, createdItem.id));
  }

  // Save external links
  const linkValues = formData.getAll("link").map(String).filter(Boolean);
  if (linkValues.length > 0) {
    const parsedLinks = linkValues.map((raw) => {
      try { return JSON.parse(raw) as { url: string; label?: string }; }
      catch { return null; }
    }).filter(Boolean) as { url: string; label?: string }[];

    if (parsedLinks.length > 0) {
      await db.insert(itemLinks).values(
        parsedLinks.map((l) => ({
          itemId: createdItem.id,
          url: l.url,
          label: l.label || null,
        }))
      );
    }
  }

  redirect(`/seller/projects/${projectId}/items`);
}

export async function updateItemAction(formData: FormData) {
  const user = await requireSeller();
  const projectId = formData.get("projectId") as string;
  const itemId = formData.get("itemId") as string;

  const rawData = {
    title: formData.get("title"),
    brand: formData.get("brand") || undefined,
    description: formData.get("description") || undefined,
    condition: formData.get("condition") || undefined,
    approximateAge: formData.get("approximateAge") || undefined,
    price: formData.get("price") ? Number(formData.get("price")) : undefined,
    originalPrice: formData.get("originalPrice") ? Number(formData.get("originalPrice")) : undefined,
    currency: formData.get("currency") || "USD",
    notes: formData.get("notes") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    status: formData.get("status") || "available",
  };

  const validated = itemFormSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: { form: ["Seller account not found"] } };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: { form: ["Project not found or unauthorized"] } };
  }

  await db
    .update(items)
    .set({
      title: validated.data.title,
      brand: validated.data.brand,
      description: validated.data.description,
      condition: validated.data.condition,
      approximateAge: validated.data.approximateAge,
      price: validated.data.price,
      originalPrice: validated.data.originalPrice,
      currency: validated.data.currency,
      notes: validated.data.notes,
      categoryId: validated.data.categoryId,
      status: validated.data.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(items.id, itemId),
        eq(items.projectId, ownedProject.id),
        isNull(items.deletedAt)
      )
    );

  // Diff-based image update: only delete removed, insert new, update sort order
  const submittedUrls = formData.getAll("imageUrl").map(String).filter(Boolean);
  const submittedHdUrls = formData.getAll("imageHdUrl").map(String);

  // Build a map of url -> hdUrl for submitted images
  const hdUrlMap = new Map<string, string | null>();
  submittedUrls.forEach((url, idx) => {
    hdUrlMap.set(url, submittedHdUrls[idx] || null);
  });

  // Fetch current images from DB
  const currentImages = await db
    .select({ id: itemImages.id, url: itemImages.url })
    .from(itemImages)
    .where(eq(itemImages.itemId, itemId));

  const currentUrlSet = new Set(currentImages.map((img) => img.url));
  const submittedUrlSet = new Set(submittedUrls);

  // Images to remove (in DB but not in submitted list)
  const toRemoveIds = currentImages
    .filter((img) => !submittedUrlSet.has(img.url))
    .map((img) => img.id);

  // Images to add (in submitted list but not in DB)
  const toAdd = submittedUrls.filter((url) => !currentUrlSet.has(url));

  // Apply changes in a transaction
  await db.transaction(async (tx) => {
    // Delete removed images
    if (toRemoveIds.length > 0) {
      await tx.delete(itemImages).where(inArray(itemImages.id, toRemoveIds));
    }

    // Insert new images
    if (toAdd.length > 0) {
      await tx.insert(itemImages).values(
        toAdd.map((url) => ({
          itemId,
          url,
          hdUrl: hdUrlMap.get(url) ?? null,
          sortOrder: 0, // Will be corrected below
        }))
      );
    }

    // Update sort order for all remaining images to match submitted order
    for (let idx = 0; idx < submittedUrls.length; idx++) {
      await tx
        .update(itemImages)
        .set({ sortOrder: idx })
        .where(
          and(eq(itemImages.itemId, itemId), eq(itemImages.url, submittedUrls[idx]))
        );
    }
  });

  // Update cover image
  if (submittedUrls.length > 0) {
    await db
      .update(items)
      .set({ coverImageUrl: submittedUrls[0] })
      .where(eq(items.id, itemId));
  } else if (currentImages.length > 0 && submittedUrls.length === 0) {
    // Only clear cover if user explicitly removed all images
    await db
      .update(items)
      .set({ coverImageUrl: null })
      .where(eq(items.id, itemId));
  }

  // Diff-based link update: only delete removed, insert new
  const linkValues = formData.getAll("link").map(String).filter(Boolean);
  const parsedLinks = linkValues
    .map((raw) => {
      try { return JSON.parse(raw) as { url: string; label?: string }; }
      catch { return null; }
    })
    .filter(Boolean) as { url: string; label?: string }[];

  // Fetch current links from DB
  const currentLinks = await db
    .select({ id: itemLinks.id, url: itemLinks.url, label: itemLinks.label })
    .from(itemLinks)
    .where(eq(itemLinks.itemId, itemId));

  // Build a key for comparison (url + normalized label)
  const linkKey = (url: string, label?: string | null) =>
    `${url}||${(label ?? "").trim()}`;

  const currentKeyMap = new Map(
    currentLinks.map((l) => [linkKey(l.url, l.label), l.id])
  );
  const submittedKeySet = new Set(
    parsedLinks.map((l) => linkKey(l.url, l.label))
  );

  // Links to remove (in DB but not in submitted list)
  const linkIdsToRemove = currentLinks
    .filter((l) => !submittedKeySet.has(linkKey(l.url, l.label)))
    .map((l) => l.id);

  // Links to add (in submitted list but not in DB)
  const linksToAdd = parsedLinks.filter(
    (l) => !currentKeyMap.has(linkKey(l.url, l.label))
  );

  await db.transaction(async (tx) => {
    if (linkIdsToRemove.length > 0) {
      await tx.delete(itemLinks).where(inArray(itemLinks.id, linkIdsToRemove));
    }
    if (linksToAdd.length > 0) {
      await tx.insert(itemLinks).values(
        linksToAdd.map((l) => ({
          itemId,
          url: l.url,
          label: l.label || null,
        }))
      );
    }
  });

  redirect(`/seller/projects/${projectId}/items`);
}

const updateStatusSchema = z.object({
  itemId: z.string().uuid(),
  projectId: z.string().min(1),
  status: z.enum(ITEM_STATUSES),
});

export async function updateItemStatusAction(formData: FormData) {
  const user = await requireSeller();

  const parsed = updateStatusSchema.safeParse({
    itemId: formData.get("itemId"),
    projectId: formData.get("projectId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  const { itemId, projectId, status } = parsed.data;

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: "Seller account not found" };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: "Project not found or unauthorized" };
  }

  // Fetch existing item to carry over reservedForUserId when marking as sold
  const existingItem = await db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      eq(items.projectId, ownedProject.id),
      isNull(items.deletedAt)
    ),
  });

  if (!existingItem) {
    return { error: "Item not found" };
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { status, updatedAt: now };

  // When marking as sold, carry over reservation buyer if exists
  if (status === "sold" && existingItem.reservedForUserId) {
    updateData.soldToUserId = existingItem.reservedForUserId;
    updateData.soldAt = now;
  }

  // When marking as sold without reserved buyer, just set soldAt
  if (status === "sold" && !existingItem.reservedForUserId) {
    updateData.soldAt = now;
  }

  // When changing away from reserved, clear reservation fields
  if (status !== "reserved" && status !== "sold") {
    updateData.reservedForUserId = null;
    updateData.reservedAt = null;
  }

  await db
    .update(items)
    .set(updateData)
    .where(
      and(
        eq(items.id, itemId),
        eq(items.projectId, ownedProject.id),
        isNull(items.deletedAt)
      )
    );

  revalidateSellerItemsPaths(projectId);
  return { success: true };
}

export async function deleteItemAction(itemId: string, projectId: string) {
  const user = await requireSeller();

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: { form: ["Seller account not found"] } };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: { form: ["Project not found or unauthorized"] } };
  }

  await db
    .update(items)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(items.id, itemId),
        eq(items.projectId, ownedProject.id),
        isNull(items.deletedAt)
      )
    );

  redirect(`/seller/projects/${projectId}/items`);
}

/**
 * Manually link a reserved item to a buyer account.
 * The item must already be in "reserved" status.
 * buyerEmail is optional — pass null to clear the reservation link.
 */
export async function linkReservationToBuyerAction(formData: FormData) {
  const user = await requireSeller();

  const itemId = formData.get("itemId") as string;
  const projectId = formData.get("projectId") as string;
  const buyerEmail = (formData.get("buyerEmail") as string)?.trim() || null;

  if (!itemId || !projectId) {
    return { error: "Missing item or project" };
  }

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: "Seller account not found" };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: "Project not found or unauthorized" };
  }

  const item = await db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      eq(items.projectId, ownedProject.id),
      eq(items.status, "reserved"),
      isNull(items.deletedAt)
    ),
  });

  if (!item) {
    return { error: "Item not found or not in reserved status" };
  }

  let buyerUserId: string | null = null;

  if (buyerEmail) {
    const buyer = await db.query.profiles.findFirst({
      where: ilike(profiles.email, buyerEmail),
      columns: { id: true },
    });
    if (!buyer) {
      return { error: "Buyer not found with this email" };
    }
    buyerUserId = buyer.id;
  }

  await db
    .update(items)
    .set({
      reservedForUserId: buyerUserId,
      reservedAt: buyerUserId ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));

  revalidateSellerItemsPaths(projectId);
  return { success: true };
}

/**
 * Mark an item as sold and optionally link the sale to a buyer.
 * If the item was reserved for a buyer, that buyer is automatically carried over.
 */
export async function markItemSoldAction(formData: FormData) {
  const user = await requireSeller();

  const itemId = formData.get("itemId") as string;
  const projectId = formData.get("projectId") as string;
  const buyerEmail = (formData.get("buyerEmail") as string)?.trim() || null;

  if (!itemId || !projectId) {
    return { error: "Missing item or project" };
  }

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: "Seller account not found" };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: "Project not found or unauthorized" };
  }

  const item = await db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      eq(items.projectId, ownedProject.id),
      isNull(items.deletedAt)
    ),
  });

  if (!item) {
    return { error: "Item not found" };
  }

  let soldToUserId: string | null = null;
  const now = new Date();

  if (buyerEmail) {
    const buyer = await db.query.profiles.findFirst({
      where: ilike(profiles.email, buyerEmail),
      columns: { id: true },
    });
    if (!buyer) {
      return { error: "Buyer not found with this email" };
    }
    soldToUserId = buyer.id;
  } else if (item.reservedForUserId) {
    soldToUserId = item.reservedForUserId;
  }

  await db
    .update(items)
    .set({
      status: "sold",
      soldToUserId,
      soldAt: now,
      updatedAt: now,
    })
    .where(eq(items.id, itemId));

  revalidateSellerItemsPaths(projectId);
  for (const locale of siteConfig.locales) {
    revalidatePath(`/${locale}/reservations`);
    revalidatePath(`/${locale}/purchases`);
  }
  return { success: true };
}

/**
 * Search for buyers by email (for seller to link reservations/sales).
 * Restricted to buyers who already have a purchase intent or conversation
 * thread with this seller's projects, preventing full user enumeration.
 */
export async function searchBuyersAction(query: string) {
  const user = await requireSeller();

  if (!query || query.length < 3) {
    return [];
  }

  // Get this seller's project IDs.
  const sellerProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(sellerAccounts, eq(projects.sellerId, sellerAccounts.id))
    .where(eq(sellerAccounts.userId, user.id));

  if (sellerProjects.length === 0) {
    return [];
  }

  const projectIds = sellerProjects.map((p) => p.id);

  // Collect distinct buyer IDs from intents and threads for this seller's projects.
  const [intentBuyers, threadBuyers] = await Promise.all([
    db
      .selectDistinct({ buyerId: buyerIntents.userId })
      .from(buyerIntents)
      .where(inArray(buyerIntents.projectId, projectIds)),
    db
      .selectDistinct({ buyerId: conversationThreads.buyerId })
      .from(conversationThreads)
      .where(inArray(conversationThreads.projectId, projectIds)),
  ]);

  const buyerIds = [
    ...new Set([
      ...intentBuyers.map((b) => b.buyerId),
      ...threadBuyers.map((b) => b.buyerId),
    ]),
  ];

  if (buyerIds.length === 0) {
    return [];
  }

  const results = await db
    .select({ id: profiles.id, email: profiles.email, displayName: profiles.displayName })
    .from(profiles)
    .where(
      and(
        inArray(profiles.id, buyerIds),
        ilike(profiles.email, `%${query}%`)
      )
    )
    .limit(5);

  return results;
}

/**
 * Bulk-update status for a set of reserved items (all belonging to the same
 * buyer). Optionally posts a structured message to the buyer's conversation
 * thread. Allowed target statuses: "sold" | "available".
 */
export async function bulkUpdateReservedItemsAction(
  itemIds: string[],
  projectId: string,
  status: "sold" | "available",
  message?: string
) {
  if (!itemIds || itemIds.length === 0) {
    return { error: "No items provided" };
  }

  const user = await requireSeller();

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: "Seller account not found" };
  }

  const ownedProject = await findSellerProject(sellerAccountId, projectId);
  if (!ownedProject) {
    return { error: "Project not found or unauthorized" };
  }

  // Fetch all target items in one query to validate ownership and collect data.
  const targetItems = await db
    .select({
      id: items.id,
      title: items.title,
      price: items.price,
      currency: items.currency,
      reservedForUserId: items.reservedForUserId,
    })
    .from(items)
    .where(
      and(
        inArray(items.id, itemIds),
        eq(items.projectId, ownedProject.id),
        isNull(items.deletedAt)
      )
    );

  if (targetItems.length === 0) {
    return { error: "No matching items found" };
  }

  // Enforce single-buyer constraint: all items must belong to the same buyer.
  const buyerIds = new Set(targetItems.map((i) => i.reservedForUserId).filter(Boolean));
  if (buyerIds.size > 1) {
    return { error: "All items must be reserved for the same buyer" };
  }

  const buyerUserId = targetItems[0].reservedForUserId ?? null;
  const now = new Date();

  // Build the update payload.
  const updateData: Record<string, unknown> = { status, updatedAt: now };
  if (status === "sold") {
    if (buyerUserId) {
      updateData.soldToUserId = buyerUserId;
    }
    updateData.soldAt = now;
  } else {
    // "available" — release reservation
    updateData.reservedForUserId = null;
    updateData.reservedAt = null;
    updateData.soldToUserId = null;
    updateData.soldAt = null;
  }

  await db
    .update(items)
    .set(updateData)
    .where(
      and(
        inArray(items.id, itemIds),
        eq(items.projectId, ownedProject.id),
        isNull(items.deletedAt)
      )
    );

  // Optionally post a structured message to the buyer's conversation thread.
  if (message && buyerUserId) {
    const trimmedNote = message.trim();

    // Build plain-text body (emoji prefix + item list + optional seller note).
    const lines: string[] = [];
    if (status === "sold") {
      lines.push("✅ Items marqués comme vendus :");
    } else {
      lines.push("🔓 Réservation libérée :");
    }
    lines.push("");
    for (const item of targetItems) {
      const priceStr =
        item.price != null
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: item.currency ?? "EUR",
            }).format(item.price)
          : "";
      lines.push(priceStr ? `• ${item.title} — ${priceStr}` : `• ${item.title}`);
    }
    if (trimmedNote) {
      lines.push("");
      lines.push("---");
      lines.push(trimmedNote);
    }
    const body = lines.join("\n");

    // Find-or-create the thread for this buyer↔project pair.
    let thread = await db.query.conversationThreads.findFirst({
      where: and(
        eq(conversationThreads.projectId, ownedProject.id),
        eq(conversationThreads.buyerId, buyerUserId)
      ),
    });
    if (!thread) {
      const [created] = await db
        .insert(conversationThreads)
        .values({
          projectId: ownedProject.id,
          buyerId: buyerUserId,
          sellerLastReadAt: now,
        })
        .returning();
      thread = created;
    }

    await db.insert(conversationMessages).values({
      threadId: thread.id,
      senderId: user.id,
      body,
    });

    await db
      .update(conversationThreads)
      .set({ updatedAt: now, sellerLastReadAt: now })
      .where(eq(conversationThreads.id, thread.id));
  }

  revalidateSellerItemsPaths(projectId);
  revalidateReservationsPaths(projectId);
  return { success: true };
}
