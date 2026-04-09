"use server";

import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validations";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { siteConfig } from "@/config";

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

  revalidateMessagePaths(thread.id);
}
