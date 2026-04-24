import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { MessageSendForm } from "@/features/messages/components/message-send-form";
import { MessageBubble } from "@/features/messages/components/message-bubble";

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

export default async function BuyerMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const t = await getTranslations("messages");
  const user = await requireUser();

  const thread = await db.query.conversationThreads.findFirst({
    where: eq(conversationThreads.id, threadId),
  });

  if (!thread || thread.buyerId !== user.id) {
    notFound();
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, thread.projectId), isNull(projects.deletedAt)),
  });

  if (!project) {
    notFound();
  }

  const seller = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      emailVisibility: profiles.emailVisibility,
    })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(eq(sellerAccounts.id, project.sellerId))
    .limit(1);

  const sellerInfo = seller[0] ?? null;
  const sellerName = sellerInfo?.displayName ?? t("unknownSeller");

  const myProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { displayName: true },
  });
  const myName = myProfile?.displayName ?? t("you");

  const messages = await db.query.conversationMessages.findMany({
    where: eq(conversationMessages.threadId, thread.id),
    orderBy: [asc(conversationMessages.createdAt)],
  });

  if (!thread.buyerLastReadAt || thread.updatedAt > thread.buyerLastReadAt) {
    await db
      .update(conversationThreads)
      .set({ buyerLastReadAt: new Date() })
      .where(eq(conversationThreads.id, thread.id));
  }

  return (
    <div className="container px-4 md:px-6 py-4 md:py-6 max-w-3xl">
      <Link
        href="/messages"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToMessages")}
      </Link>

      <div className="mt-4 rounded-xl border bg-gradient-to-br from-orange-50/60 to-background px-4 py-3 dark:from-orange-950/20">
        <p className="text-eyebrow">{t("conversation")}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <Link
            href={`/project/${project.slug}`}
            className="inline-flex items-center gap-1.5 text-heading-4 hover:text-orange-600 dark:hover:text-orange-400"
          >
            <Package className="h-4 w-4 text-orange-500" />
            {project.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {t("withSeller", { name: sellerName })}
            {sellerInfo?.email && sellerInfo.emailVisibility === "direct"
              ? ` · ${sellerInfo.email}`
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
                senderName={isMe ? myName : sellerName}
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
