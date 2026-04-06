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
import { and, eq, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();
  const profileId = user.id;

  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "");

  const validated = messageSchema.safeParse({ body });
  if (!validated.success) {
    return;
  }

  // Verify project exists
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
    const [created] = await db
      .insert(conversationThreads)
      .values({ projectId, buyerId: profileId })
      .returning();
    thread = created;
  }

  await db.insert(conversationMessages).values({
    threadId: thread.id,
    senderId: profileId,
    body: validated.data.body,
  });

  // Update thread timestamp
  await db
    .update(conversationThreads)
    .set({ updatedAt: new Date() })
    .where(eq(conversationThreads.id, thread.id));

  revalidatePath("/messages");
  revalidatePath("/seller/messages");
}
