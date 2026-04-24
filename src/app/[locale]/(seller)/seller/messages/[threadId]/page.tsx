import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { MessageBubble } from "@/features/messages/components/message-bubble";
import { MessageSendForm } from "@/features/messages/components/message-send-form";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

export default async function SellerMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const t = await getTranslations("messages");
  const user = await requireSeller();

  const sellerAccountIds = await getSellerAccountIdsForUser(user.id);

  if (sellerAccountIds.length === 0) {
    notFound();
  }

  const thread = await db.query.conversationThreads.findFirst({
    where: eq(conversationThreads.id, threadId),
  });

  if (!thread) {
    notFound();
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, thread.projectId),
      inArray(projects.sellerId, sellerAccountIds)
    ),
  });

  if (!project) {
    notFound();
  }

  const buyer = await db.query.profiles.findFirst({
    where: eq(profiles.id, thread.buyerId),
  });
  const buyerName = buyer?.displayName ?? t("unknownBuyer");

  const myProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { displayName: true },
  });
  const myName = myProfile?.displayName ?? t("you");

  const messages = await db.query.conversationMessages.findMany({
    where: eq(conversationMessages.threadId, thread.id),
    orderBy: [asc(conversationMessages.createdAt)],
  });

  if (!thread.sellerLastReadAt || thread.updatedAt > thread.sellerLastReadAt) {
    await db
      .update(conversationThreads)
      .set({ sellerLastReadAt: new Date() })
      .where(eq(conversationThreads.id, thread.id));
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/seller/messages"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToMessages")}
      </Link>

      <div className="mt-4 rounded-xl border bg-gradient-to-br from-orange-50/60 to-background px-4 py-3 dark:from-orange-950/20">
        <p className="text-eyebrow">{t("conversation")}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-heading-4">
            <Package className="h-4 w-4 text-orange-500" />
            {project.name}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {t("withBuyer", { name: buyerName })}
            {buyer?.email && buyer.emailVisibility === "direct"
              ? ` · ${buyer.email}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border bg-card/40 p-3 md:p-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("noMessagesYet")}</p>
          </div>
        ) : (
          messages.map((message, idx) => {
            const isMe = message.senderId === user.id;
            const prev = messages[idx - 1];
            const sameSenderAsPrev =
              prev && prev.senderId === message.senderId;
            const gapMs = prev
              ? message.createdAt.valueOf() - prev.createdAt.valueOf()
              : Infinity;
            const grouped = sameSenderAsPrev && gapMs < MESSAGE_GROUP_WINDOW_MS;
            const next = messages[idx + 1];
            const isLastInGroup =
              !next ||
              next.senderId !== message.senderId ||
              next.createdAt.valueOf() - message.createdAt.valueOf() >=
                MESSAGE_GROUP_WINDOW_MS;
            return (
              <MessageBubble
                key={message.id}
                body={message.body}
                createdAt={message.createdAt}
                side={isMe ? "me" : "them"}
                senderName={isMe ? myName : buyerName}
                showAvatar={!grouped}
                showTimestamp={isLastInGroup}
              />
            );
          })
        )}
      </div>

      <div className="mt-4">
        <MessageSendForm
          threadId={thread.id}
          placeholder={t("placeholder")}
          sendLabel={t("sendMessage")}
          sendCopyLabel={t("sendCopy")}
          sentMessage={t("sent")}
        />
      </div>
    </div>
  );
}
