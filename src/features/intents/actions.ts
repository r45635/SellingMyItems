"use server";

import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  buyerWishlistItems,
  buyerWishlists,
  conversationMessages,
  conversationThreads,
  items,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { requireUser, requireSeller } from "@/lib/auth";
import { purchaseIntentSchema } from "@/lib/validations";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

export async function submitIntentAction(formData: FormData) {
  const user = await requireUser();
  const profileId = user.id;

  const rateCheck = consumeRateLimit(`intents:submit:user:${profileId}`, {
    windowMs: 10 * 60 * 1000,
    max: 8,
  });
  if (!rateCheck.ok) {
    return;
  }

  const itemIds = formData.getAll("itemId").map(String).filter(Boolean);

  const rawData = {
    phone: formData.get("phone") || undefined,
    contactMethod: formData.get("contactMethod") || "app_message",
    pickupNotes: formData.get("pickupNotes") || undefined,
    itemIds,
  };

  const validated = purchaseIntentSchema.safeParse(rawData);
  if (!validated.success) {
    return;
  }

  // Verify all items exist and belong to the same project
  const selectedItems = await db
    .select({ id: items.id, projectId: items.projectId, title: items.title })
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

  // Auto-create in-app message to notify seller
  const itemList = selectedItems.map((i) => `• ${i.title}`).join("\n");
  let messageBody = `📋 New purchase intent\n\nRequested items:\n${itemList}`;
  if (validated.data.phone) {
    messageBody += `\n\n📞 Phone: ${validated.data.phone}`;
  }
  if (validated.data.pickupNotes) {
    messageBody += `\n\n📝 Notes: ${validated.data.pickupNotes}`;
  }

  // Find or create conversation thread for this buyer + project
  let thread = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.projectId, projectId),
      eq(conversationThreads.buyerId, profileId)
    ),
  });

  if (!thread) {
    const [created] = await db
      .insert(conversationThreads)
      .values({ projectId, buyerId: profileId })
      .returning();
    thread = created;
  }

  await db.insert(conversationMessages).values({
    threadId: thread.id,
    senderId: profileId,
    body: messageBody,
  });

  await db
    .update(conversationThreads)
    .set({ updatedAt: new Date() })
    .where(eq(conversationThreads.id, thread.id));

  revalidatePath("/wishlist");
  revalidatePath("/seller/intents");
  revalidatePath("/messages");
  revalidatePath("/seller/messages");

  redirect("/messages");
}

export async function updateIntentStatusAction(
  intentId: string,
  status: "reviewed" | "accepted" | "declined"
) {
  const user = await requireSeller();
  const profileId = user.id;

  const sellerAccountIds = await getSellerAccountIdsForUser(profileId);

  if (sellerAccountIds.length === 0) {
    return { error: "Seller account not found" };
  }

  const intent = await db.query.buyerIntents.findFirst({
    where: eq(buyerIntents.id, intentId),
  });

  if (!intent) {
    return { error: "Intent not found" };
  }

  // Verify seller owns the project
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, intent.projectId),
      inArray(projects.sellerId, sellerAccountIds),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    return { error: "Unauthorized" };
  }

  await db
    .update(buyerIntents)
    .set({ status, updatedAt: new Date() })
    .where(eq(buyerIntents.id, intentId));

  revalidatePath("/seller/intents");
  return { success: true };
}
