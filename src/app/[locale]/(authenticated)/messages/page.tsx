import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { sendMessageAction } from "@/features/messages/actions";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

function getProfileIdForUser(user: {
  id: string;
  isDemo?: boolean;
  role?: "guest" | "seller";
}) {
  if (!user.isDemo) return user.id;
  return user.role === "seller"
    ? DEMO_SELLER_PROFILE_ID
    : DEMO_GUEST_PROFILE_ID;
}

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const user = await requireUser();
  const profileId = getProfileIdForUser(user);

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
        projectName: project?.name ?? "Unknown",
        projectSlug: project?.slug ?? "",
        messageCount: messages.length,
        lastMessageBody: lastMessage?.body ?? "",
        lastMessageDate: lastMessage?.createdAt,
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
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/project/${thread.projectSlug}`}
                    className="font-medium hover:underline"
                  >
                    {thread.projectName}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {thread.messageCount} message(s)
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
