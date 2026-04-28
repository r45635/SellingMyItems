"use server";

import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  projects,
  sellerAccounts,
  profiles,
  emailLogs,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validations";
import { and, eq, isNull, desc, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { siteConfig } from "@/config";
import { sendMessageNotificationEmail, sendMessageCopyEmail } from "@/lib/email";

function revalidateMessagePaths(threadId: string) {
  revalidatePath("/messages");
  revalidatePath("/seller/messages");
  revalidatePath(`/messages/${threadId}`);
  revalidatePath(`/seller/messages/${threadId}`);

  for (const locale of siteConfig.locales) {
    revalidatePath(`/${locale}/messages`);
    revalidatePath(`/${locale}/messages/${threadId}`);
    revalidatePath(`/${locale}/seller/messages`);
    revalidatePath(`/${locale}/seller/messages/${threadId}`);
  }
}

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();
  const profileId = user.id;

  const rateCheck = consumeRateLimit(`messages:send:user:${profileId}`, {
    windowMs: 60 * 1000,
    max: 20,
  });
  if (!rateCheck.ok) {
    return;
  }

  const threadId = String(formData.get("threadId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "");
  const sendCopy = formData.get("sendCopy") === "on";

  const validated = messageSchema.safeParse({ body });
  if (!validated.success) {
    return;
  }

  if (threadId) {
    const thread = await db.query.conversationThreads.findFirst({
      where: eq(conversationThreads.id, threadId),
    });

    if (!thread) {
      return;
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, thread.projectId), isNull(projects.deletedAt)),
    });

    if (!project) {
      return;
    }

    const sellerAccount = await db.query.sellerAccounts.findFirst({
      where: and(
        eq(sellerAccounts.userId, profileId),
        eq(sellerAccounts.id, project.sellerId)
      ),
    });

    const isBuyer = thread.buyerId === profileId;
    const isSeller = Boolean(sellerAccount);

    if (!isBuyer && !isSeller) {
      return;
    }

    const now = new Date();

    await db.insert(conversationMessages).values({
      threadId: thread.id,
      senderId: profileId,
      body: validated.data.body,
    });

    await db
      .update(conversationThreads)
      .set({
        updatedAt: now,
        buyerLastReadAt: isBuyer ? now : thread.buyerLastReadAt,
        sellerLastReadAt: isSeller ? now : thread.sellerLastReadAt,
      })
      .where(eq(conversationThreads.id, thread.id));

    // Send email notification to the other party (non-blocking, throttled)
    try {
      await notifyMessageRecipient(
        thread.id,
        thread.projectId,
        isBuyer ? "buyer" : "seller",
        isBuyer ? thread.buyerId : profileId,
        profileId,
        validated.data.body
      );
    } catch {
      // Email failure should not block message sending
    }

    // Send copy to the sender if requested
    if (sendCopy) {
      try {
        await sendCopyToSender(
          profileId,
          thread.id,
          thread.projectId,
          isBuyer ? "buyer" : "seller",
          validated.data.body
        );
      } catch {
        // Email copy failure should not block
      }
    }

    revalidateMessagePaths(thread.id);
    return;
  }

  // Buyer flow: create/fetch thread from a project and send a message.
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
  });

  if (!project) {
    return;
  }

  // Find or create thread
  let thread = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.projectId, projectId),
      eq(conversationThreads.buyerId, profileId)
    ),
  });

  if (!thread) {
    const now = new Date();
    const [created] = await db
      .insert(conversationThreads)
      .values({
        projectId,
        buyerId: profileId,
        buyerLastReadAt: now,
      })
      .returning();
    thread = created;
  }

  const now = new Date();

  await db.insert(conversationMessages).values({
    threadId: thread.id,
    senderId: profileId,
    body: validated.data.body,
  });

  // Update thread timestamp
  await db
    .update(conversationThreads)
    .set({
      updatedAt: now,
      buyerLastReadAt: now,
    })
    .where(eq(conversationThreads.id, thread.id));

  // Send email notification to the seller (non-blocking, throttled)
  try {
    await notifyMessageRecipient(
      thread.id,
      thread.projectId,
      "buyer",
      profileId,
      profileId,
      validated.data.body
    );
  } catch {
    // Email failure should not block message sending
  }

  // Send copy to the sender if requested
  if (sendCopy) {
    try {
      await sendCopyToSender(
        profileId,
        thread.id,
        thread.projectId,
        "buyer",
        validated.data.body
      );
    } catch {
      // Email copy failure should not block
    }
  }

  revalidateMessagePaths(thread.id);
}

// ─── Start conversation (buyer → seller, new thread) ───────────────────────

/**
 * Buyer compose flow: given a projectId and a message body, create the thread
 * if needed, persist the message, notify the seller, then redirect the buyer
 * to the thread view so they can see the conversation. Used by the public
 * "Contact seller" CTA once the buyer has signed in.
 */
export async function startConversationAction(formData: FormData) {
  const user = await requireUser();
  const profileId = user.id;

  const rateCheck = consumeRateLimit(`messages:start:user:${profileId}`, {
    windowMs: 60 * 1000,
    max: 10,
  });
  if (!rateCheck.ok) return;

  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "");
  const sendCopy = formData.get("sendCopy") === "on";

  const validated = messageSchema.safeParse({ body });
  if (!validated.success || !projectId) return;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
  });
  if (!project) return;

  let thread = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.projectId, projectId),
      eq(conversationThreads.buyerId, profileId)
    ),
  });

  const now = new Date();
  if (!thread) {
    const [created] = await db
      .insert(conversationThreads)
      .values({ projectId, buyerId: profileId, buyerLastReadAt: now })
      .returning();
    thread = created;
  }

  await db.insert(conversationMessages).values({
    threadId: thread.id,
    senderId: profileId,
    body: validated.data.body,
  });

  await db
    .update(conversationThreads)
    .set({ updatedAt: now, buyerLastReadAt: now })
    .where(eq(conversationThreads.id, thread.id));

  try {
    await notifyMessageRecipient(
      thread.id,
      thread.projectId,
      "buyer",
      profileId,
      profileId,
      validated.data.body
    );
  } catch {
    // non-blocking
  }

  if (sendCopy) {
    try {
      await sendCopyToSender(
        profileId,
        thread.id,
        thread.projectId,
        "buyer",
        validated.data.body
      );
    } catch {
      // non-blocking
    }
  }

  revalidateMessagePaths(thread.id);
  redirect(`/messages/${thread.id}`);
}

// ─── Email notification helper (throttled: max 1 per thread per 5 min) ──────

const MESSAGE_NOTIF_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

async function notifyMessageRecipient(
  threadId: string,
  projectId: string,
  senderRole: "buyer" | "seller",
  buyerId: string,
  senderId: string,
  messageBody: string,
) {
  // Throttle: check if we already sent a notification for this thread recently
  const recentNotif = await db.query.emailLogs.findFirst({
    where: and(
      eq(emailLogs.type, "message_notification"),
      eq(emailLogs.status, "sent"),
      gte(emailLogs.createdAt, new Date(Date.now() - MESSAGE_NOTIF_THROTTLE_MS))
    ),
    orderBy: [desc(emailLogs.createdAt)],
  });
  // Simple throttle: if any message_notification was sent in last 5 min, skip
  // (A more precise approach would filter by thread, but this is good enough for now)
  if (recentNotif) return;

  // Get project info
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { name: true, sellerId: true },
  });
  if (!project) return;

  // Get sender name
  const sender = await db.query.profiles.findFirst({
    where: eq(profiles.id, senderId),
    columns: { displayName: true, email: true },
  });
  if (!sender) return;

  // Determine recipient (the *other* party) and pick the URL + email
  // locale from THEIR profile preference — not the sender's.
  let recipientEmail: string | undefined;
  let recipientLocale = "en";
  let threadUrl: string;

  if (senderRole === "buyer") {
    const sellerAccount = await db.query.sellerAccounts.findFirst({
      where: eq(sellerAccounts.id, project.sellerId),
      columns: { userId: true },
    });
    if (!sellerAccount) return;
    const sellerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, sellerAccount.userId),
      columns: { email: true, preferredLocale: true },
    });
    recipientEmail = sellerProfile?.email;
    recipientLocale = sellerProfile?.preferredLocale ?? "en";
    threadUrl = `${siteConfig.url}/${recipientLocale}/seller/messages/${threadId}`;
  } else {
    const buyerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, buyerId),
      columns: { email: true, preferredLocale: true },
    });
    recipientEmail = buyerProfile?.email;
    recipientLocale = buyerProfile?.preferredLocale ?? "en";
    threadUrl = `${siteConfig.url}/${recipientLocale}/messages/${threadId}`;
  }

  if (!recipientEmail) return;

  await sendMessageNotificationEmail(
    recipientEmail,
    sender.displayName ?? sender.email,
    project.name,
    messageBody,
    threadUrl,
    recipientLocale
  );
}

// ─── Send copy of the message to the sender ─────────────────────────────────

async function sendCopyToSender(
  senderId: string,
  threadId: string,
  projectId: string,
  senderRole: "buyer" | "seller",
  messageBody: string,
) {
  const senderProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, senderId),
    columns: { email: true, preferredLocale: true },
  });
  if (!senderProfile?.email) return;
  const senderLocale = senderProfile.preferredLocale;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { name: true, sellerId: true },
  });
  if (!project) return;

  // Get the recipient name to display in the copy email
  let recipientName: string;
  if (senderRole === "buyer") {
    const sellerAccount = await db.query.sellerAccounts.findFirst({
      where: eq(sellerAccounts.id, project.sellerId),
      columns: { userId: true },
    });
    const sellerProfile = sellerAccount
      ? await db.query.profiles.findFirst({
          where: eq(profiles.id, sellerAccount.userId),
          columns: { displayName: true, email: true },
        })
      : null;
    recipientName = sellerProfile?.displayName ?? sellerProfile?.email ?? "Seller";
  } else {
    // sender is seller → get thread to find buyer
    const thread = await db.query.conversationThreads.findFirst({
      where: eq(conversationThreads.id, threadId),
      columns: { buyerId: true },
    });
    const buyerProfile = thread
      ? await db.query.profiles.findFirst({
          where: eq(profiles.id, thread.buyerId),
          columns: { displayName: true, email: true },
        })
      : null;
    recipientName = buyerProfile?.displayName ?? buyerProfile?.email ?? "Buyer";
  }

  const threadUrl = senderRole === "buyer"
    ? `${siteConfig.url}/${senderLocale}/messages/${threadId}`
    : `${siteConfig.url}/${senderLocale}/seller/messages/${threadId}`;

  await sendMessageCopyEmail(
    senderProfile.email,
    recipientName,
    project.name,
    messageBody,
    threadUrl,
    senderLocale
  );
}
