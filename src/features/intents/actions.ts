"use server";

import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  buyerWishlistItems,
  buyerWishlists,
  items,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { requireUser, requireSeller } from "@/lib/auth";
import { purchaseIntentSchema } from "@/lib/validations";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

function getProfileIdForUser(user: {
  id: string;
  isDemo?: boolean;
  role?: "purchaser" | "seller";
}) {
  if (!user.isDemo) return user.id;
  return user.role === "seller"
    ? DEMO_SELLER_PROFILE_ID
    : DEMO_GUEST_PROFILE_ID;
}

async function ensureProfile(profileId: string, email: string) {
  await db
    .insert(profiles)
    .values({ id: profileId, email, passwordHash: "", displayName: email.split("@")[0] })
    .onConflictDoNothing({ target: profiles.id });
}

export async function submitIntentAction(formData: FormData) {
  const user = await requireUser();
  const profileId = getProfileIdForUser(user);
  await ensureProfile(profileId, user.email);

  const itemIds = formData.getAll("itemId").map(String).filter(Boolean);

  const rawData = {
    phone: formData.get("phone") || undefined,
    contactMethod: formData.get("contactMethod") || "email",
    pickupNotes: formData.get("pickupNotes") || undefined,
    itemIds,
  };

  const validated = purchaseIntentSchema.safeParse(rawData);
  if (!validated.success) {
    return;
  }

  // Verify all items exist and belong to the same project
  const selectedItems = await db
    .select({ id: items.id, projectId: items.projectId })
    .from(items)
    .where(
      and(inArray(items.id, validated.data.itemIds), isNull(items.deletedAt))
    );

  if (selectedItems.length === 0) {
    return;
  }

  const projectId = selectedItems[0].projectId;
  const allSameProject = selectedItems.every(
    (i) => i.projectId === projectId
  );
  if (!allSameProject) {
    return;
  }

  const [intent] = await db
    .insert(buyerIntents)
    .values({
      userId: profileId,
      projectId,
      phone: validated.data.phone,
      contactMethod: validated.data.contactMethod,
      pickupNotes: validated.data.pickupNotes,
      status: "submitted",
    })
    .returning();

  await db.insert(buyerIntentItems).values(
    selectedItems.map((item) => ({
      intentId: intent.id,
      itemId: item.id,
    }))
  );

  revalidatePath("/wishlist");
  revalidatePath("/seller/intents");
}

export async function updateIntentStatusAction(
  intentId: string,
  status: "reviewed" | "accepted" | "declined"
) {
  const user = await requireSeller();
  const profileId = getProfileIdForUser(user);

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
  });

  if (!sellerAccount) {
    return { error: "Compte vendeur introuvable" };
  }

  const intent = await db.query.buyerIntents.findFirst({
    where: eq(buyerIntents.id, intentId),
  });

  if (!intent) {
    return { error: "Intention introuvable" };
  }

  // Verify seller owns the project
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, intent.projectId),
      eq(projects.sellerId, sellerAccount.id),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    return { error: "Non autorisé" };
  }

  await db
    .update(buyerIntents)
    .set({ status, updatedAt: new Date() })
    .where(eq(buyerIntents.id, intentId));

  revalidatePath("/seller/intents");
  return { success: true };
}
