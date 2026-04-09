import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth";
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
import { ArrowLeft } from "lucide-react";
import { sendMessageAction } from "@/features/messages/actions";

export default async function SellerMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const t = await getTranslations("messages");
  const user = await requireSeller();

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });

  if (!sellerAccount) {
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
      eq(projects.sellerId, sellerAccount.id),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    notFound();
  }

  const buyer = await db.query.profiles.findFirst({
    where: eq(profiles.id, thread.buyerId),
  });

  const messages = await db.query.conversationMessages.findMany({
    where: eq(conversationMessages.threadId, thread.id),
    orderBy: [asc(conversationMessages.createdAt)],
  });

  return (
    <div className="space-y-4">
      <Link
        href="/seller/messages"
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to messages
      </Link>

      <div className="rounded-lg border p-4 space-y-1">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {buyer?.displayName ?? "Unknown buyer"}
          {buyer?.email ? ` (${buyer.email})` : ""}
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((message) => {
            const isSellerMessage = message.senderId === user.id;

            return (
              <div
                key={message.id}
                className={`flex ${isSellerMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isSellerMessage
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p
                    className={`mt-1 text-[11px] ${
                      isSellerMessage
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form action={sendMessageAction} className="flex gap-2">
        <input type="hidden" name="threadId" value={thread.id} />
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
  );
}
