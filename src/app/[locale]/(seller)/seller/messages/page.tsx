import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Link } from "@/i18n/navigation";

export default async function SellerMessagesPage() {
  const t = await getTranslations("messages");
  const user = await requireSeller();
  const profileId = user.id;

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
  });

  if (!sellerAccount) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noThreads")}
        </div>
      </div>
    );
  }

  const sellerProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(
      and(
        eq(projects.sellerId, sellerAccount.id),
        isNull(projects.deletedAt)
      )
    );

  const projectIds = sellerProjects.map((p) => p.id);
  const projectMap = new Map(sellerProjects.map((p) => [p.id, p.name]));

  if (projectIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noThreads")}
        </div>
      </div>
    );
  }

  const threads = await db.query.conversationThreads.findMany({
    where: inArray(conversationThreads.projectId, projectIds),
    orderBy: [desc(conversationThreads.updatedAt)],
  });

  const buyerIds = [...new Set(threads.map((thread) => thread.buyerId))];

  const buyers =
    buyerIds.length > 0
      ? await db
          .select({
            id: profiles.id,
            displayName: profiles.displayName,
            email: profiles.email,
          })
          .from(profiles)
          .where(inArray(profiles.id, buyerIds))
      : [];

  const buyerMap = new Map(
    buyers.map((buyer) => [
      buyer.id,
      {
        displayName: buyer.displayName ?? t("unknownBuyer"),
        email: buyer.email,
      },
    ])
  );

  const threadIds = threads.map((thread) => thread.id);
  const allMessages =
    threadIds.length > 0
      ? await db
          .select({
            threadId: conversationMessages.threadId,
            senderId: conversationMessages.senderId,
            body: conversationMessages.body,
            createdAt: conversationMessages.createdAt,
          })
          .from(conversationMessages)
          .where(inArray(conversationMessages.threadId, threadIds))
          .orderBy(desc(conversationMessages.createdAt))
      : [];

  const threadStats = new Map<
    string,
    {
      messageCount: number;
      lastMessageBody: string;
      lastMessageDate: Date | null;
      lastMessageSenderId: string | null;
    }
  >();

  for (const message of allMessages) {
    const existing = threadStats.get(message.threadId);
    if (!existing) {
      threadStats.set(message.threadId, {
        messageCount: 1,
        lastMessageBody: message.body,
        lastMessageDate: message.createdAt,
        lastMessageSenderId: message.senderId,
      });
      continue;
    }

    existing.messageCount += 1;
  }

  const groupedThreads = threads.reduce<
    Array<{
      projectId: string;
      projectName: string;
      threads: Array<{
        id: string;
        buyerName: string;
        buyerEmail: string;
        messageCount: number;
        lastMessageBody: string;
        lastMessageDate: Date | null;
        lastMessageSenderId: string | null;
      }>;
    }>
  >((groups, thread) => {
    const buyer = buyerMap.get(thread.buyerId);
    const stats = threadStats.get(thread.id);

    const threadData = {
      id: thread.id,
      buyerName: buyer?.displayName ?? "Unknown",
      buyerEmail: buyer?.email ?? "",
      messageCount: stats?.messageCount ?? 0,
      lastMessageBody: stats?.lastMessageBody ?? "",
      lastMessageDate: stats?.lastMessageDate ?? null,
      lastMessageSenderId: stats?.lastMessageSenderId ?? null,
    };

    const existingGroup = groups.find((group) => group.projectId === thread.projectId);
    if (existingGroup) {
      existingGroup.threads.push(threadData);
      return groups;
    }

    groups.push({
      projectId: thread.projectId,
      projectName: projectMap.get(thread.projectId) ?? t("unknownProject"),
      threads: [threadData],
    });
    return groups;
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {groupedThreads.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noThreads")}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedThreads.map((group) => (
            <section key={group.projectId} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="font-semibold">{group.projectName}</h2>
                <span className="text-xs text-muted-foreground">
                  {group.threads.length} {t("threadsCount")}
                </span>
              </div>

              <div className="space-y-2">
                {group.threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/seller/messages/${thread.id}`}
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium truncate">
                        {thread.buyerName}
                        {thread.buyerEmail ? ` (${thread.buyerEmail})` : ""}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {thread.messageCount} {t("messagesCount")}
                      </span>
                    </div>
                    {thread.lastMessageBody && (
                      <div className="mt-1 rounded-md bg-muted/40 p-2">
                        <p className="text-xs text-muted-foreground mb-1">
                          {t("lastMessage")}: {thread.lastMessageSenderId === profileId ? t("you") : t("buyer")}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.lastMessageBody}
                        </p>
                      </div>
                    )}
                    {thread.lastMessageDate && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("lastActivity")}: {new Date(thread.lastMessageDate).toLocaleString()}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
