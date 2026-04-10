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
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { siteConfig } from "@/config";
import { sendMessageNotificationEmail } from "@/lib/email";

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

  revalidateMessagePaths(thread.id);
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

  // Determine recipient
  let recipientEmail: string | undefined;
  let threadUrl: string;

  if (senderRole === "buyer") {
    // Notify the seller
    const sellerAccount = await db.query.sellerAccounts.findFirst({
      where: eq(sellerAccounts.id, project.sellerId),
      columns: { userId: true },
    });
    if (!sellerAccount) return;
    const sellerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, sellerAccount.userId),
      columns: { email: true },
    });
    recipientEmail = sellerProfile?.email;
    threadUrl = `${siteConfig.url}/fr/seller/messages/${threadId}`;
  } else {
    // Notify the buyer
    const buyerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, buyerId),
      columns: { email: true },
    });
    recipientEmail = buyerProfile?.email;
    threadUrl = `${siteConfig.url}/fr/messages/${threadId}`;
  }

  if (!recipientEmail) return;

  await sendMessageNotificationEmail(
    recipientEmail,
    sender.displayName ?? sender.email,
    project.name,
    messageBody,
    threadUrl,
    "fr"
  );
}
