import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  profiles,
  projects,
} from "@/db/schema";
import { eq, desc, inArray, or } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { MessageSquare, ShoppingCart, Tag } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { MessageAvatar } from "@/features/messages/components/message-avatar";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";
import { cn } from "@/lib/utils";

type Side = "buyer" | "seller";

type EnrichedThread = {
  id: string;
  side: Side;
  href: string;
  title: string;
  subtitle: string;
  preview: string;
  isFromMe: boolean;
  lastMessageDate: Date | null;
  isUnread: boolean;
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ side?: string }>;
}) {
  const { side: rawSide } = await searchParams;
  const sideFilter: "all" | Side =
    rawSide === "buyer" || rawSide === "seller" ? rawSide : "all";

  const t = await getTranslations("messages");
  const user = await requireUser();
  const profileId = user.id;

  const sellerAccountIds = await getSellerAccountIdsForUser(profileId);

  // Buyer-side projects: anything where I'm the buyerId.
  const buyerThreads = await db.query.conversationThreads.findMany({
    where: eq(conversationThreads.buyerId, profileId),
    orderBy: [desc(conversationThreads.updatedAt)],
  });

  // Seller-side: threads on projects owned by my sellerAccount(s).
  let sellerThreadsRaw: typeof buyerThreads = [];
  let sellerProjectMap = new Map<string, string>();
  if (sellerAccountIds.length > 0) {
    const ownedProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.sellerId, sellerAccountIds));
    sellerProjectMap = new Map(ownedProjects.map((p) => [p.id, p.name]));
    const projectIds = ownedProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      sellerThreadsRaw = await db.query.conversationThreads.findMany({
        where: inArray(conversationThreads.projectId, projectIds),
        orderBy: [desc(conversationThreads.updatedAt)],
      });
    }
  }

  // Pull project names + last message + unread for everything in one go.
  const allThreadIds = [
    ...buyerThreads.map((t) => t.id),
    ...sellerThreadsRaw.map((t) => t.id),
  ];

  const buyerProjectIds = [...new Set(buyerThreads.map((t) => t.projectId))];
  const buyerProjects = buyerProjectIds.length
    ? await db
        .select({ id: projects.id, name: projects.name, slug: projects.slug })
        .from(projects)
        .where(inArray(projects.id, buyerProjectIds))
    : [];
  const buyerProjectMap = new Map(
    buyerProjects.map((p) => [p.id, { name: p.name, slug: p.slug }])
  );

  const allBuyerIds = [
    ...new Set(sellerThreadsRaw.map((thread) => thread.buyerId)),
  ];
  const counterpartyBuyers = allBuyerIds.length
    ? await db
        .select({
          id: profiles.id,
          displayName: profiles.displayName,
        })
        .from(profiles)
        .where(inArray(profiles.id, allBuyerIds))
    : [];
  const buyerNameMap = new Map(
    counterpartyBuyers.map((b) => [b.id, b.displayName ?? t("unknownBuyer")])
  );

  const lastMessages = allThreadIds.length
    ? await db
        .select({
          threadId: conversationMessages.threadId,
          senderId: conversationMessages.senderId,
          body: conversationMessages.body,
          createdAt: conversationMessages.createdAt,
        })
        .from(conversationMessages)
        .where(
          or(...allThreadIds.map((id) => eq(conversationMessages.threadId, id)))
        )
        .orderBy(desc(conversationMessages.createdAt))
    : [];

  type LastMsg = { body: string; createdAt: Date; senderId: string };
  const lastByThread = new Map<string, LastMsg>();
  for (const m of lastMessages) {
    if (!lastByThread.has(m.threadId)) {
      lastByThread.set(m.threadId, {
        body: m.body,
        createdAt: m.createdAt,
        senderId: m.senderId,
      });
    }
  }

  const truncate = (s: string) =>
    s.length > 90 ? s.slice(0, 90) + "…" : s;

  const buyerEnriched: EnrichedThread[] = buyerThreads.map((thread) => {
    const last = lastByThread.get(thread.id);
    const project = buyerProjectMap.get(thread.projectId);
    return {
      id: thread.id,
      side: "buyer",
      href: `/messages/${thread.id}`,
      title: project?.name ?? t("unknownProject"),
      subtitle: t("buyer"),
      preview: last ? truncate(last.body) : "",
      isFromMe: last?.senderId === profileId,
      lastMessageDate: last?.createdAt ?? null,
      isUnread:
        !thread.buyerLastReadAt || thread.updatedAt > thread.buyerLastReadAt,
    };
  });

  const sellerEnriched: EnrichedThread[] = sellerThreadsRaw.map((thread) => {
    const last = lastByThread.get(thread.id);
    const projectName =
      sellerProjectMap.get(thread.projectId) ?? t("unknownProject");
    const buyerName = buyerNameMap.get(thread.buyerId) ?? t("unknownBuyer");
    return {
      id: thread.id,
      side: "seller",
      href: `/seller/messages/${thread.id}`,
      title: `${projectName} · ${buyerName}`,
      subtitle: t("seller"),
      preview: last ? truncate(last.body) : "",
      isFromMe: last?.senderId === profileId,
      lastMessageDate: last?.createdAt ?? null,
      isUnread:
        !thread.sellerLastReadAt || thread.updatedAt > thread.sellerLastReadAt,
    };
  });

  const allThreads = [...buyerEnriched, ...sellerEnriched].sort((a, b) => {
    const ad = a.lastMessageDate?.valueOf() ?? 0;
    const bd = b.lastMessageDate?.valueOf() ?? 0;
    return bd - ad;
  });

  const filtered =
    sideFilter === "all"
      ? allThreads
      : allThreads.filter((thread) => thread.side === sideFilter);

  const buyerCount = buyerEnriched.filter((tt) => tt.isUnread).length;
  const sellerCount = sellerEnriched.filter((tt) => tt.isUnread).length;
  const hasSellerCapability = sellerAccountIds.length > 0;

  const tabs: Array<{
    id: "all" | Side;
    label: string;
    badge: number;
  }> = [
    {
      id: "all",
      label: t("filterAll"),
      badge: buyerCount + sellerCount,
    },
    { id: "buyer", label: t("filterAsBuyer"), badge: buyerCount },
    ...(hasSellerCapability
      ? [
          {
            id: "seller" as const,
            label: t("filterAsSeller"),
            badge: sellerCount,
          },
        ]
      : []),
  ];

  return (
    <div className="container px-4 md:px-6 py-6 md:py-8 max-w-3xl">
      <h1 className="text-heading-2 mb-4">{t("title")}</h1>

      {hasSellerCapability && (
        <div className="mb-4 inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
          {tabs.map((tab) => {
            const isActive = tab.id === sideFilter;
            const href =
              tab.id === "all" ? "/messages" : `/messages?side=${tab.id}`;
            return (
              <Link
                key={tab.id}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      isActive
                        ? "bg-red-500 text-white"
                        : "bg-muted-foreground/20 text-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("noThreads")}
          description={t("noThreadsDesc")}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card overflow-hidden">
          {filtered.map((thread) => {
            const SideIcon = thread.side === "buyer" ? ShoppingCart : Tag;
            const sidePillClass =
              thread.side === "buyer"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50"
                : "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900/50";
            return (
              <li key={`${thread.side}:${thread.id}`}>
                <Link
                  href={thread.href}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <div className="relative">
                    <MessageAvatar name={thread.title} />
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
                        className={cn(
                          "truncate text-sm",
                          thread.isUnread ? "font-semibold" : "font-medium"
                        )}
                      >
                        {thread.title}
                      </p>
                      {thread.lastMessageDate && (
                        <LocalizedDateTime
                          value={thread.lastMessageDate}
                          className="shrink-0 text-[11px] text-muted-foreground"
                        />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-semibold ring-1",
                          sidePillClass
                        )}
                      >
                        <SideIcon className="h-2.5 w-2.5" />
                        {thread.subtitle}
                      </span>
                      {thread.preview && (
                        <p
                          className={cn(
                            "truncate text-sm",
                            thread.isUnread
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {thread.isFromMe && (
                            <span className="text-muted-foreground">
                              {t("you")}:{" "}
                            </span>
                          )}
                          {thread.preview}
                        </p>
                      )}
                    </div>
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
