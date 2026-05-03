"use server";

import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  conversationMessages,
  conversationThreads,
  items,
  profiles,
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
import { sendIntentReceivedEmail, sendIntentStatusEmail } from "@/lib/email";
import { siteConfig } from "@/config";

const TERMINAL_STATUSES = ["accepted", "declined", "cancelled"] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

function isTerminal(s: string): s is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(s);
}

/**
 * Find or create the conversation thread for a (project, buyer) pair,
 * and ensure it carries a back-reference to the intent that owns it.
 * Returns the thread row.
 */
async function ensureThreadForIntent(
  projectId: string,
  buyerId: string,
  intentId: string
) {
  const existing = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.projectId, projectId),
      eq(conversationThreads.buyerId, buyerId)
    ),
  });

  if (existing) {
    if (!existing.intentId) {
      await db
        .update(conversationThreads)
        .set({ intentId })
        .where(eq(conversationThreads.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(conversationThreads)
    .values({ projectId, buyerId, intentId })
    .returning();
  return created;
}

/**
 * Insert a system-style message into the thread on behalf of `senderId`
 * and bump the thread's updatedAt so the unread badge surfaces it. The
 * counterparty sees this in /messages exactly like a normal message,
 * which is the whole point — state changes ride the existing notification
 * surface instead of relying on email alone.
 */
async function postIntentSystemMessage(
  threadId: string,
  senderId: string,
  body: string
) {
  const now = new Date();
  await db.insert(conversationMessages).values({
    threadId,
    senderId,
    body,
  });
  await db
    .update(conversationThreads)
    .set({ updatedAt: now })
    .where(eq(conversationThreads.id, threadId));
}

export async function submitIntentAction(formData: FormData) {
  const user = await requireUser();
  const profileId = user.id;

  const rateCheck = await consumeRateLimit(`intents:submit:user:${profileId}`, {
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
    .select({ id: items.id, projectId: items.projectId, title: items.title, status: items.status })
    .from(items)
    .where(
      and(inArray(items.id, validated.data.itemIds), isNull(items.deletedAt))
    );

  if (selectedItems.length === 0) {
    return;
  }

  // Only allow intents on available items
  const unavailableItems = selectedItems.filter((i) => i.status !== "available");
  if (unavailableItems.length > 0) {
    return;
  }

  const projectId = selectedItems[0].projectId;
  const allSameProject = selectedItems.every(
    (i) => i.projectId === projectId
  );
  if (!allSameProject) {
    return;
  }

  // Limit: only 1 active (submitted/reviewed) intent per buyer per
  // project. `cancelled`/`accepted`/`declined` don't count, so the user
  // can re-submit once the previous one is finalized or withdrawn.
  const existingActiveIntent = await db.query.buyerIntents.findFirst({
    where: and(
      eq(buyerIntents.userId, profileId),
      eq(buyerIntents.projectId, projectId),
      inArray(buyerIntents.status, ["submitted", "reviewed"])
    ),
  });
  if (existingActiveIntent) {
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

  // Auto-create / link thread, then post the intent summary as the
  // first message — gives the buyer something visible in their inbox
  // immediately and the seller a notification.
  const thread = await ensureThreadForIntent(projectId, profileId, intent.id);
  const itemList = selectedItems.map((i) => `• ${i.title}`).join("\n");
  let messageBody = `📋 New purchase intent\n\nRequested items:\n${itemList}`;
  if (validated.data.phone) {
    messageBody += `\n\n📞 Phone: ${validated.data.phone}`;
  }
  if (validated.data.pickupNotes) {
    messageBody += `\n\n📝 Notes: ${validated.data.pickupNotes}`;
  }
  await postIntentSystemMessage(thread.id, profileId, messageBody);

  // Send email notification to seller (non-blocking)
  try {
    const projectForEmail = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { sellerId: true, name: true },
    });
    if (projectForEmail) {
      const sellerAccount = await db.query.sellerAccounts.findFirst({
        where: eq(sellerAccounts.id, projectForEmail.sellerId),
        columns: { userId: true },
      });
      if (sellerAccount) {
        const sellerProfile = await db.query.profiles.findFirst({
          where: eq(profiles.id, sellerAccount.userId),
          columns: { email: true, preferredLocale: true },
        });
        const buyerProfile = await db.query.profiles.findFirst({
          where: eq(profiles.id, profileId),
          columns: { displayName: true, email: true },
        });
        if (sellerProfile && buyerProfile) {
          const sellerLocale = sellerProfile.preferredLocale;
          await sendIntentReceivedEmail(
            sellerProfile.email,
            buyerProfile.displayName ?? buyerProfile.email,
            projectForEmail.name,
            selectedItems.map((i) => i.title),
            `${siteConfig.url}/${sellerLocale}/seller/intents`,
            sellerLocale
          );
        }
      }
    }
  } catch {
    // Email failure should not block intent submission
  }

  revalidatePath("/wishlist");
  revalidatePath("/my-intents");
  revalidatePath("/seller/intents");
  revalidatePath("/messages");
  revalidatePath("/seller/messages");

  redirect("/messages");
}

/**
 * Seller transitions an intent. `accepted`/`declined` are terminal and
 * post a system message into the existing conversation thread so the
 * buyer's unread badge fires. `declined` accepts an optional reviewer
 * note (≤500 chars) — surfaced both in the conversation and on the
 * buyer's intents page.
 */
export async function updateIntentStatusAction(
  intentId: string,
  status: "reviewed" | "accepted" | "declined",
  note?: string
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

  const trimmedNote =
    status === "declined" && note?.trim()
      ? note.trim().slice(0, 500)
      : null;

  const now = new Date();
  await db
    .update(buyerIntents)
    .set({
      status,
      reviewerNote: status === "declined" ? trimmedNote : null,
      updatedAt: now,
    })
    .where(eq(buyerIntents.id, intentId));

  // Post system message in the buyer's thread so the unread badge fires
  // and the conversation has the full state history. Skipped for the
  // intermediate `reviewed` state — that's silent on purpose.
  if (status === "accepted" || status === "declined") {
    const thread = await ensureThreadForIntent(
      intent.projectId,
      intent.userId,
      intent.id
    );
    const body =
      status === "accepted"
        ? "✅ Le vendeur a accepté votre demande."
        : trimmedNote
          ? `❌ Le vendeur a décliné votre demande.\n\n${trimmedNote}`
          : "❌ Le vendeur a décliné votre demande.";
    await postIntentSystemMessage(thread.id, profileId, body);
  }

  // Send email notification to buyer for accepted/declined (non-blocking)
  if (status === "accepted" || status === "declined") {
    try {
      const buyerProfile = await db.query.profiles.findFirst({
        where: eq(profiles.id, intent.userId),
        columns: { email: true, preferredLocale: true },
      });
      if (buyerProfile) {
        await sendIntentStatusEmail(
          buyerProfile.email,
          status,
          project.name,
          buyerProfile.preferredLocale
        );
      }
    } catch {
      // Email failure should not block status update
    }
  }

  revalidatePath("/seller/intents");
  revalidatePath("/my-intents");
  revalidatePath("/messages");
  return { success: true };
}

export async function reserveItemsFromIntentAction(
  intentId: string,
  selectedItemIds: string[]
) {
  const user = await requireSeller();
  const profileId = user.id;

  if (selectedItemIds.length === 0) {
    return { error: "No items selected" };
  }

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

  const intentItemRows = await db
    .select({ itemId: buyerIntentItems.itemId })
    .from(buyerIntentItems)
    .where(eq(buyerIntentItems.intentId, intentId));
  const intentItemIdSet = new Set(intentItemRows.map((r) => r.itemId));

  const invalidItems = selectedItemIds.filter((id) => !intentItemIdSet.has(id));
  if (invalidItems.length > 0) {
    return { error: "Some items do not belong to this intent" };
  }

  const itemsToReserve = await db
    .select({ id: items.id, status: items.status, title: items.title })
    .from(items)
    .where(
      and(
        inArray(items.id, selectedItemIds),
        isNull(items.deletedAt)
      )
    );

  const unavailable = itemsToReserve.filter((i) => i.status !== "available");
  if (unavailable.length > 0) {
    return { error: "Some items are no longer available" };
  }

  const now = new Date();

  await db
    .update(items)
    .set({
      status: "reserved",
      reservedForUserId: intent.userId,
      reservedAt: now,
      updatedAt: now,
    })
    .where(inArray(items.id, selectedItemIds));

  await db
    .update(buyerIntents)
    .set({ status: "accepted", updatedAt: now })
    .where(eq(buyerIntents.id, intentId));

  const reservedTitles = itemsToReserve.map((i) => `• ${i.title}`).join("\n");
  const messageBody = `✅ Items reserved for you:\n${reservedTitles}\n\nPlease arrange pickup and payment with the seller.`;

  const thread = await ensureThreadForIntent(
    intent.projectId,
    intent.userId,
    intent.id
  );
  await postIntentSystemMessage(thread.id, profileId, messageBody);

  try {
    const buyerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, intent.userId),
      columns: { email: true, preferredLocale: true },
    });
    if (buyerProfile) {
      await sendIntentStatusEmail(
        buyerProfile.email,
        "accepted",
        project.name,
        buyerProfile.preferredLocale
      );
    }
  } catch {
    // Email failure should not block reservation
  }

  revalidatePath("/seller/intents");
  revalidatePath("/my-intents");
  revalidatePath("/wishlist");
  revalidatePath("/reservations");
  revalidatePath("/messages");
  return { success: true };
}

/**
 * Buyer withdraws a still-pending intent. Frees the
 * one-active-intent-per-project lock so they can re-submit.
 */
export async function cancelIntentAction(intentId: string) {
  const user = await requireUser();
  const profileId = user.id;

  const intent = await db.query.buyerIntents.findFirst({
    where: eq(buyerIntents.id, intentId),
  });
  if (!intent) {
    return { error: "Intent not found" };
  }
  if (intent.userId !== profileId) {
    return { error: "Unauthorized" };
  }
  if (intent.status !== "submitted" && intent.status !== "reviewed") {
    return { error: "Only pending intents can be cancelled" };
  }

  const now = new Date();
  await db
    .update(buyerIntents)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(buyerIntents.id, intentId));

  // Notify the seller via the conversation thread.
  const thread = await ensureThreadForIntent(
    intent.projectId,
    intent.userId,
    intent.id
  );
  await postIntentSystemMessage(
    thread.id,
    profileId,
    "🚫 L'acheteur a annulé sa demande."
  );

  revalidatePath("/my-intents");
  revalidatePath("/seller/intents");
  revalidatePath("/messages");
  revalidatePath("/seller/messages");
  return { success: true };
}

/**
 * Hide a finalized intent from both lists. Either party can archive,
 * the field is shared. Reversible via unarchiveIntentAction.
 */
export async function archiveIntentAction(intentId: string) {
  const user = await requireUser();
  const profileId = user.id;

  const intent = await db.query.buyerIntents.findFirst({
    where: eq(buyerIntents.id, intentId),
  });
  if (!intent) {
    return { error: "Intent not found" };
  }

  // Authorize: must be the buyer OR the seller who owns the project.
  let allowed = intent.userId === profileId;
  if (!allowed) {
    const sellerAccountIds = await getSellerAccountIdsForUser(profileId);
    if (sellerAccountIds.length > 0) {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, intent.projectId),
          inArray(projects.sellerId, sellerAccountIds)
        ),
      });
      allowed = Boolean(project);
    }
  }
  if (!allowed) {
    return { error: "Unauthorized" };
  }

  if (!isTerminal(intent.status)) {
    return { error: "Only finalized intents can be archived" };
  }

  const now = new Date();
  await db
    .update(buyerIntents)
    .set({ archivedAt: now, archivedBy: profileId, updatedAt: now })
    .where(eq(buyerIntents.id, intentId));

  revalidatePath("/my-intents");
  revalidatePath("/seller/intents");
  return { success: true };
}

export async function unarchiveIntentAction(intentId: string) {
  const user = await requireUser();
  const profileId = user.id;

  const intent = await db.query.buyerIntents.findFirst({
    where: eq(buyerIntents.id, intentId),
  });
  if (!intent) {
    return { error: "Intent not found" };
  }

  let allowed = intent.userId === profileId;
  if (!allowed) {
    const sellerAccountIds = await getSellerAccountIdsForUser(profileId);
    if (sellerAccountIds.length > 0) {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, intent.projectId),
          inArray(projects.sellerId, sellerAccountIds)
        ),
      });
      allowed = Boolean(project);
    }
  }
  if (!allowed) {
    return { error: "Unauthorized" };
  }

  await db
    .update(buyerIntents)
    .set({ archivedAt: null, archivedBy: null, updatedAt: new Date() })
    .where(eq(buyerIntents.id, intentId));

  revalidatePath("/my-intents");
  revalidatePath("/seller/intents");
  return { success: true };
}
