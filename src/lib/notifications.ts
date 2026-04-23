import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";

type NotificationType =
  | "invitation_received"
  | "access_granted"
  | "access_declined"
  | "access_revoked"
  | "access_requested";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  projectId?: string;
}) {
  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    linkUrl: params.linkUrl,
    projectId: params.projectId,
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt))
    );
  return rows.length;
}

export async function listNotifications(userId: string, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
