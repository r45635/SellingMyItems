import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
} from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { MessageSquare, Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { MessageAvatar } from "@/features/messages/components/message-avatar";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

export default async function SellerMessagesPage() {
  const t = await getTranslations("messages");
  const user = await requireSeller();
  const profileId = user.id;

  const sellerAccountIds = await getSellerAccountIdsForUser(profileId);

  if (sellerAccountIds.length === 0) {
    return (
      <div>
        <h1 className="text-heading-2 mb-6">{t("title")}</h1>
        <EmptyState
          icon={MessageSquare}
          title={t("noThreads")}
          description={t("noThreadsSellerDesc")}
        />
      </div>
    );
  }

  const sellerProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(inArray(projects.sellerId, sellerAccountIds));

  const projectIds = sellerProjects.map((p) => p.id);
  const projectMap = new Map(sellerProjects.map((p) => [p.id, p.name]));

  if (projectIds.length === 0) {
    return (
      <div>
        <h1 className="text-heading-2 mb-6">{t("title")}</h1>
        <EmptyState
          icon={MessageSquare}
          title={t("noThreads")}
          description={t("noThreadsSellerDesc")}
        />
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
            emailVisibility: profiles.emailVisibility,
          })
          .from(profiles)
          .where(inArray(profiles.id, buyerIds))
      : [];

  const buyerMap = new Map(
    buyers.map((buyer) => [
      buyer.id,
      {
        displayName: buyer.displayName ?? t("unknownBuyer"),
        email: buyer.emailVisibility === "direct" ? buyer.email : "",
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

  type LastMessage = {
    body: string;
    createdAt: Date;
    senderId: string;
    count: number;
  };
  const threadStats = new Map<string, LastMessage>();
  for (const message of allMessages) {
    const existing = threadStats.get(message.threadId);
    if (!existing) {
      threadStats.set(message.threadId, {
        body: message.body,
        createdAt: message.createdAt,
        senderId: message.senderId,
        count: 1,
      });
    } else {
      existing.count += 1;
    }
  }

  const groupedThreads = threads.reduce<
    Array<{
      projectId: string;
      projectName: string;
      threads: Array<{
        id: string;
        buyerName: string;
        buyerEmail: string;
        lastMessageBody: string;
        lastMessageDate: Date | null;
        lastMessageSenderId: string | null;
        isUnread: boolean;
      }>;
    }>
  >((groups, thread) => {
    const buyer = buyerMap.get(thread.buyerId);
    const stats = threadStats.get(thread.id);

    const threadData = {
      id: thread.id,
      buyerName: buyer?.displayName ?? "Unknown",
      buyerEmail: buyer?.email ?? "",
      lastMessageBody: stats?.body ?? "",
      lastMessageDate: stats?.createdAt ?? null,
      lastMessageSenderId: stats?.senderId ?? null,
      isUnread:
        !thread.sellerLastReadAt || thread.updatedAt > thread.sellerLastReadAt,
    };

    const existingGroup = groups.find(
      (group) => group.projectId === thread.projectId
    );
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
    <div className="max-w-3xl">
      <h1 className="text-heading-2 mb-6">{t("title")}</h1>

      {groupedThreads.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("noThreads")}
          description={t("noThreadsSellerDesc")}
        />
      ) : (
        <div className="space-y-5">
          {groupedThreads.map((group) => (
            <section key={group.projectId} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Package className="h-4 w-4 text-orange-500" />
                <h2 className="text-eyebrow">{group.projectName}</h2>
                <span className="ml-1 text-[11px] text-muted-foreground">
                  {group.threads.length}
                </span>
              </div>
              <ul className="divide-y rounded-xl border bg-card overflow-hidden">
                {group.threads.map((thread) => {
                  const preview =
                    thread.lastMessageBody.length > 90
                      ? thread.lastMessageBody.slice(0, 90) + "…"
                      : thread.lastMessageBody;
                  const isFromMe = thread.lastMessageSenderId === profileId;
                  return (
                    <li key={thread.id}>
                      <Link
                        href={`/seller/messages/${thread.id}`}
                        className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
                      >
                        <div className="relative">
                          <MessageAvatar name={thread.buyerName} />
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
                                thread.isUnread
                                  ? "font-semibold"
                                  : "font-medium"
                              }`}
                            >
                              {thread.buyerName}
                              {thread.buyerEmail ? (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  · {thread.buyerEmail}
                                </span>
                              ) : null}
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
