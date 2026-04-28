import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  conversationThreads,
  items,
  projects,
} from "@/db/schema";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  ExternalLink,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import {
  BuyerArchiveButton,
  CancelIntentButton,
} from "@/features/intents/components/buyer-intent-actions";

const STATUSES = [
  "submitted",
  "reviewed",
  "accepted",
  "declined",
  "cancelled",
] as const;
type IntentStatus = (typeof STATUSES)[number];

const STATUS_PILL: Record<IntentStatus, string> = {
  submitted:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  reviewed:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
  accepted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  declined:
    "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  cancelled:
    "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const PENDING_STATUSES = ["submitted", "reviewed"] as const;
const RESUBMITTABLE_STATUSES = ["declined", "cancelled"] as const;

export default async function MyIntentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: "active" | "archived" =
    sp.tab === "archived" ? "archived" : "active";

  const tMy = await getTranslations("myIntents");
  const tStatus = await getTranslations("intentStatus");
  const user = await requireUser();
  const profileId = user.id;

  // Two count queries up front so the tabs always show both totals.
  const allRows = await db
    .select({ id: buyerIntents.id, archivedAt: buyerIntents.archivedAt })
    .from(buyerIntents)
    .where(eq(buyerIntents.userId, profileId));
  const activeCount = allRows.filter((r) => !r.archivedAt).length;
  const archivedCount = allRows.filter((r) => r.archivedAt).length;

  const tabCondition =
    tab === "archived"
      ? isNotNull(buyerIntents.archivedAt)
      : isNull(buyerIntents.archivedAt);

  const intents = await db.query.buyerIntents.findMany({
    where: and(eq(buyerIntents.userId, profileId), tabCondition),
    orderBy: [desc(buyerIntents.createdAt)],
  });

  const enriched = await Promise.all(
    intents.map(async (intent) => {
      const intentItems = await db
        .select({
          itemId: items.id,
          itemTitle: items.title,
          itemPrice: items.price,
          itemCurrency: items.currency,
          itemStatus: items.status,
        })
        .from(buyerIntentItems)
        .innerJoin(items, eq(buyerIntentItems.itemId, items.id))
        .where(eq(buyerIntentItems.intentId, intent.id));

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, intent.projectId),
        columns: { id: true, name: true, slug: true },
      });

      const thread = await db.query.conversationThreads.findFirst({
        where: and(
          eq(conversationThreads.projectId, intent.projectId),
          eq(conversationThreads.buyerId, profileId)
        ),
        columns: { id: true },
      });

      return {
        ...intent,
        items: intentItems,
        projectName: project?.name ?? "—",
        projectSlug: project?.slug ?? "",
        threadId: thread?.id ?? null,
      };
    })
  );

  const buildTabHref = (next: "active" | "archived") =>
    next === "active" ? "/my-intents" : "/my-intents?tab=archived";

  // Surface pending intents at the top so a buyer scrolling on mobile
  // sees what's waiting on the seller before what's settled.
  const sorted = [...enriched].sort((a, b) => {
    const aPending = (PENDING_STATUSES as readonly string[]).includes(a.status)
      ? 0
      : 1;
    const bPending = (PENDING_STATUSES as readonly string[]).includes(b.status)
      ? 0
      : 1;
    if (aPending !== bPending) return aPending - bPending;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const archiveLabels = {
    archive: tMy("archive"),
    unarchive: tMy("unarchive"),
    archivedToast: tMy("archivedToast"),
    unarchivedToast: tMy("unarchivedToast"),
  };

  const cancelLabels = {
    cancel: tMy("cancel"),
    confirm: tMy("cancelConfirm"),
    toast: tMy("cancelledToast"),
  };

  return (
    <div className="container px-4 md:px-6 py-6 md:py-8 max-w-3xl">
      <h1 className="text-heading-2 mb-2">{tMy("title")}</h1>
      <p className="text-sm text-muted-foreground mb-5">
        {tMy("description")}
      </p>

      <div className="mb-5 inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
        {(["active", "archived"] as const).map((id) => {
          const isActive = id === tab;
          const count = id === "active" ? activeCount : archivedCount;
          return (
            <Link
              key={id}
              href={buildTabHref(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>
                {id === "active" ? tMy("tabActive") : tMy("tabArchived")}
              </span>
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted-foreground/20 text-foreground"
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            tab === "archived" ? tMy("emptyArchived") : tMy("emptyActive")
          }
          description={tab === "active" ? tMy("emptyActiveDesc") : undefined}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((intent) => {
            const status = intent.status as IntentStatus;
            const isPending = (PENDING_STATUSES as readonly string[]).includes(
              status
            );
            const isResubmittable = (
              RESUBMITTABLE_STATUSES as readonly string[]
            ).includes(status);
            const isFinalized = !isPending;

            return (
              <article
                key={intent.id}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3 transition-opacity",
                  intent.archivedAt && "opacity-70"
                )}
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {intent.projectSlug ? (
                      <Link
                        href={`/project/${intent.projectSlug}`}
                        className="font-medium hover:text-orange-600 dark:hover:text-orange-400 inline-flex items-center gap-1"
                      >
                        {intent.projectName}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    ) : (
                      <span className="font-medium">{intent.projectName}</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <LocalizedDateTime
                        value={intent.createdAt}
                        className="inline"
                      />
                      {" · "}
                      {tMy("itemCount", { count: intent.items.length })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      STATUS_PILL[status]
                    )}
                  >
                    {tStatus(status)}
                  </span>
                </header>

                <ul className="space-y-0.5 text-sm">
                  {intent.items.map((item) => (
                    <li
                      key={item.itemId}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <span className="flex-1 truncate">
                        {item.itemTitle}
                        {item.itemPrice != null
                          ? ` — ${item.itemPrice} ${item.itemCurrency}`
                          : ""}
                      </span>
                      {item.itemStatus === "reserved" && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Reserved
                        </span>
                      )}
                      {item.itemStatus === "sold" && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white">
                          Sold
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {intent.reviewerNote && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/50">
                    <p className="font-semibold mb-0.5">
                      {tMy("sellerNote")}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {intent.reviewerNote}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {intent.threadId && (
                    <Link
                      href={`/messages/${intent.threadId}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {tMy("openThread")}
                    </Link>
                  )}
                  {isPending && (
                    <CancelIntentButton
                      intentId={intent.id}
                      labels={cancelLabels}
                    />
                  )}
                  {isResubmittable && intent.projectSlug && (
                    <Link
                      href={`/project/${intent.projectSlug}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-orange-600 px-3 text-xs font-medium text-white hover:bg-orange-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {tMy("resubmit")}
                    </Link>
                  )}
                  {isFinalized && (
                    <BuyerArchiveButton
                      intentId={intent.id}
                      isArchived={Boolean(intent.archivedAt)}
                      labels={archiveLabels}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
