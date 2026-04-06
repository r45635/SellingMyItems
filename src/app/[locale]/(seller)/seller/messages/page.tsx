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
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { sendMessageAction } from "@/features/messages/actions";

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

  // Fetch all threads for seller's projects
  const allThreads = [];
  for (const pid of projectIds) {
    const threads = await db.query.conversationThreads.findMany({
      where: eq(conversationThreads.projectId, pid),
      orderBy: [desc(conversationThreads.updatedAt)],
    });
    allThreads.push(...threads);
  }

  // Sort all threads by update date
  allThreads.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const enrichedThreads = await Promise.all(
    allThreads.map(async (thread) => {
      const buyer = await db.query.profiles.findFirst({
        where: eq(profiles.id, thread.buyerId),
      });

      const messages = await db.query.conversationMessages.findMany({
        where: eq(conversationMessages.threadId, thread.id),
        orderBy: [desc(conversationMessages.createdAt)],
      });

      const lastMessage = messages[0];

      return {
        ...thread,
        projectName: projectMap.get(thread.projectId) ?? "Unknown",
        buyerName: buyer?.displayName ?? "Unknown",
        buyerEmail: buyer?.email ?? "",
        messageCount: messages.length,
        lastMessageBody: lastMessage?.body ?? "",
        lastMessageDate: lastMessage?.createdAt,
      };
    })
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {enrichedThreads.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noThreads")}
        </div>
      ) : (
        <div className="space-y-4">
          {enrichedThreads.map((thread) => (
            <div key={thread.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {thread.buyerName} ({thread.buyerEmail})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {thread.projectName} • {thread.messageCount} message(s)
                    {thread.lastMessageDate &&
                      ` • ${new Date(thread.lastMessageDate).toLocaleDateString()}`}
                  </p>
                </div>
              </div>

              {thread.lastMessageBody && (
                <p className="text-sm text-muted-foreground truncate">
                  {thread.lastMessageBody}
                </p>
              )}

              {/* Quick reply form */}
              <form action={sendMessageAction} className="flex gap-2">
                <input type="hidden" name="projectId" value={thread.projectId} />
                <input
                  name="body"
                  type="text"
                  placeholder={t("placeholder")}
                  required
                  className="flex-1 rounded-md border border-input px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
                  {t("sendMessage")}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
