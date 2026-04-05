"use server";

import { requireSeller } from "@/lib/auth";
import { itemFormSchema } from "@/lib/validations";
import { db } from "@/db";
import { items, itemImages, itemLinks, projects, sellerAccounts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";

function getProfileIdForUser(user: { id: string; isDemo?: boolean; role?: "guest" | "seller" }) {
  if (!user.isDemo) {
    return user.id;
  }
  return user.role === "seller" ? DEMO_SELLER_PROFILE_ID : user.id;
}

async function getSellerAccountId(user: { id: string; email: string; isDemo?: boolean; role?: "guest" | "seller" }) {
  const profileId = getProfileIdForUser(user);
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
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

  // Replace images: delete old, insert new
  const imageUrlValues = formData.getAll("imageUrl").map(String).filter(Boolean);
  await db.delete(itemImages).where(eq(itemImages.itemId, itemId));
  if (imageUrlValues.length > 0) {
    await db.insert(itemImages).values(
      imageUrlValues.map((url, idx) => ({
        itemId,
        url,
        sortOrder: idx,
      }))
    );
    await db
      .update(items)
      .set({ coverImageUrl: imageUrlValues[0] })
      .where(eq(items.id, itemId));
  } else {
    await db
      .update(items)
      .set({ coverImageUrl: null })
      .where(eq(items.id, itemId));
  }

  // Replace links: delete old, insert new
  const linkValues = formData.getAll("link").map(String).filter(Boolean);
  await db.delete(itemLinks).where(eq(itemLinks.itemId, itemId));
  if (linkValues.length > 0) {
    const parsedLinks = linkValues.map((raw) => {
      try { return JSON.parse(raw) as { url: string; label?: string }; }
      catch { return null; }
    }).filter(Boolean) as { url: string; label?: string }[];

    if (parsedLinks.length > 0) {
      await db.insert(itemLinks).values(
        parsedLinks.map((l) => ({
          itemId,
          url: l.url,
          label: l.label || null,
        }))
      );
    }
  }

  redirect(`/seller/projects/${projectId}/items`);
}

export async function deleteItemAction(projectId: string, itemId: string) {
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
