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
      };
    })
  );

  return (
    <div className="container px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {enrichedThreads.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noThreads")}
        </div>
      ) : (
        <div className="space-y-4">
          {enrichedThreads.map((thread) => (
            <div key={thread.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/project/${thread.projectSlug}`}
                    className="font-medium hover:underline"
                  >
                    {thread.projectName}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {thread.messageCount} {t("messagesCount")}
                    {thread.lastMessageDate &&
                      ` • ${t("lastActivity")}: ${new Date(thread.lastMessageDate).toLocaleString()}`}
                  </p>
                </div>
                <Link
                  href={`/messages/${thread.id}`}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                >
                  {t("openThread")}
                </Link>
              </div>

              {thread.lastMessageBody && (
                <div className="rounded-md bg-muted/40 p-2.5">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("lastMessage")}: {thread.lastMessageSenderId === profileId ? t("you") : t("seller")}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {thread.lastMessageBody}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
