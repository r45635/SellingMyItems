"use server";

import { requireSeller } from "@/lib/auth";
import { itemFormSchema, ITEM_STATUSES } from "@/lib/validations";
import { db } from "@/db";
import { items, itemImages, itemLinks, projects, sellerAccounts } from "@/db/schema";
import { and, eq, isNull, inArray, notInArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    return { error: { form: ["Compte vendeur introuvable"] } };
  }

  const ownedProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccountId),
      isNull(projects.deletedAt)
    ),
  });

  if (!ownedProject) {
    return { error: { form: ["Projet introuvable ou non autorisé"] } };
  }

  const [createdItem] = await db.insert(items).values({
    projectId,
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
  if (imageUrlValues.length > 0) {
    await db.insert(itemImages).values(
      imageUrlValues.map((url, idx) => ({
        itemId: createdItem.id,
        url,
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
    return { error: { form: ["Compte vendeur introuvable"] } };
  }

  const ownedProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccountId),
      isNull(projects.deletedAt)
    ),
  });

  if (!ownedProject) {
    return { error: { form: ["Projet introuvable ou non autorisé"] } };
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
        eq(items.projectId, projectId),
        isNull(items.deletedAt)
      )
    );

  // Diff-based image update: only delete removed, insert new, update sort order
  const submittedUrls = formData.getAll("imageUrl").map(String).filter(Boolean);

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
  projectId: z.string().uuid(),
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
    return { error: "Compte vendeur introuvable" };
  }

  const ownedProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccountId),
      isNull(projects.deletedAt)
    ),
  });

  if (!ownedProject) {
    return { error: "Projet introuvable ou non autorisé" };
  }

  await db
    .update(items)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(items.id, itemId),
        eq(items.projectId, projectId),
        isNull(items.deletedAt)
      )
    );

  revalidatePath(`/seller/projects/${projectId}/items`);
  return { success: true };
}

export async function deleteItemAction(itemId: string, projectId: string) {
  const user = await requireSeller();

  const sellerAccountId = await getSellerAccountId(user);
  if (!sellerAccountId) {
    return { error: { form: ["Compte vendeur introuvable"] } };
  }

  const ownedProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccountId),
      isNull(projects.deletedAt)
    ),
  });

  if (!ownedProject) {
    return { error: { form: ["Projet introuvable ou non autorisé"] } };
  }

  await db
    .update(items)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(items.id, itemId),
        eq(items.projectId, projectId),
        isNull(items.deletedAt)
      )
    );

  redirect(`/seller/projects/${projectId}/items`);
}
