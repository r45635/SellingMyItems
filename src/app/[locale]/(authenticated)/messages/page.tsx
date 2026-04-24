import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  projects,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { MessageAvatar } from "@/features/messages/components/message-avatar";

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const user = await requireUser();
  const profileId = user.id;

  const threads = await db.query.conversationThreads.findMany({
    where: eq(conversationThreads.buyerId, profileId),
    orderBy: [desc(conversationThreads.updatedAt)],
  });

  const enrichedThreads = await Promise.all(
    threads.map(async (thread) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, thread.projectId),
      });

      const messages = await db.query.conversationMessages.findMany({
        where: eq(conversationMessages.threadId, thread.id),
        orderBy: [desc(conversationMessages.createdAt)],
      });

      const lastMessage = messages[0];

      return {
        ...thread,
        projectName: project?.name ?? t("unknownProject"),
        projectSlug: project?.slug ?? "",
        messageCount: messages.length,
        lastMessageBody: lastMessage?.body ?? "",
        lastMessageDate: lastMessage?.createdAt,
        lastMessageSenderId: lastMessage?.senderId ?? null,
        isUnread:
          !thread.buyerLastReadAt || thread.updatedAt > thread.buyerLastReadAt,
      };
    })
  );

  return (
    <div className="container px-4 md:px-6 py-6 md:py-8 max-w-3xl">
      <h1 className="text-heading-2 mb-6">{t("title")}</h1>

      {enrichedThreads.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("noThreads")}
          description={t("noThreadsDesc")}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card overflow-hidden">
          {enrichedThreads.map((thread) => {
            const preview =
              thread.lastMessageBody.length > 90
                ? thread.lastMessageBody.slice(0, 90) + "…"
                : thread.lastMessageBody;
            const isFromMe = thread.lastMessageSenderId === profileId;
            return (
              <li key={thread.id}>
                <Link
                  href={`/messages/${thread.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <div className="relative">
                    <MessageAvatar name={thread.projectName} />
                    {thread.isUnread && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
                        aria-label={t("new")}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate text-sm ${
                          thread.isUnread ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {thread.projectName}
                      </p>
                      {thread.lastMessageDate && (
                        <LocalizedDateTime
                          value={thread.lastMessageDate}
                          className="shrink-0 text-[11px] text-muted-foreground"
                        />
                      )}
                    </div>
                    {preview && (
                      <p
                        className={`mt-0.5 truncate text-sm ${
                          thread.isUnread
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isFromMe && (
                          <span className="text-muted-foreground">
                            {t("you")}:{" "}
                          </span>
                        )}
                        {preview}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
