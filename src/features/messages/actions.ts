"use server";

import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validations";
import { and, eq, isNull, desc } from "drizzle-orm";
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

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();
  const profileId = getProfileIdForUser(user);
  await ensureProfile(profileId, user.email);

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
