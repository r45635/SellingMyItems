import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  conversationThreads,
  items,
  profiles,
  projects,
} from "@/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";
import { ReserveItemsForm } from "@/features/intents/components/reserve-items-form";
import {
  ArchiveButton,
  PendingIntentActions,
} from "@/features/intents/components/seller-intent-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { cn } from "@/lib/utils";
import { Inbox, MessageSquare, Phone } from "lucide-react";

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

export default async function SellerIntentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const tab: "active" | "archived" = sp.tab === "archived" ? "archived" : "active";
  const statusFilter: "all" | IntentStatus =
    sp.status && STATUSES.includes(sp.status as IntentStatus)
      ? (sp.status as IntentStatus)
      : "all";

  const t = await getTranslations("seller");
  const tIntent = await getTranslations("intent");
  const tStatus = await getTranslations("intentStatus");
  const tSeller = await getTranslations("sellerIntents");
  const user = await requireSeller();
  const profileId = user.id;

  const sellerAccountIds = await getSellerAccountIdsForUser(profileId);

  if (sellerAccountIds.length === 0) {
    return (
      <div>
        <h1 className="text-heading-2 mb-6">{t("intents")}</h1>
        <EmptyState icon={Inbox} title={t("noProjects")} />
      </div>
    );
  }

  const sellerProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        inArray(projects.sellerId, sellerAccountIds),
        isNull(projects.deletedAt)
      )
    );

  const projectIds = sellerProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    return (
      <div>
        <h1 className="text-heading-2 mb-6">{t("intents")}</h1>
        <EmptyState icon={Inbox} title={t("noProjects")} />
      </div>
    );
  }

  // Counts feed the tab badges. We always compute both so the user can
  // see how many are sitting in archive without switching tabs.
  const allRows = await db
    .select({ id: buyerIntents.id, archivedAt: buyerIntents.archivedAt })
    .from(buyerIntents)
    .where(inArray(buyerIntents.projectId, projectIds));
  const activeCount = allRows.filter((r) => !r.archivedAt).length;
  const archivedCount = allRows.filter((r) => r.archivedAt).length;

  // Status filter on top of the tab.
  const statusCondition =
    statusFilter === "all"
      ? undefined
      : eq(buyerIntents.status, statusFilter);

  const tabCondition =
    tab === "archived"
      ? isNotNull(buyerIntents.archivedAt)
      : isNull(buyerIntents.archivedAt);

  const intents = await db.query.buyerIntents.findMany({
    where: and(
      inArray(buyerIntents.projectId, projectIds),
      tabCondition,
      statusCondition
    ),
    orderBy: [desc(buyerIntents.createdAt)],
  });

  const enrichedIntents = await Promise.all(
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

      const buyer = await db.query.profiles.findFirst({
        where: eq(profiles.id, intent.userId),
      });

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, intent.projectId),
      });

      // Find the conversation thread for this intent — used by the
      // "Message buyer" CTA. Prefer the FK; fall back to (project,
      // buyer) for legacy threads created before the FK was added.
      const thread = await db.query.conversationThreads.findFirst({
        where: and(
          eq(conversationThreads.projectId, intent.projectId),
          eq(conversationThreads.buyerId, intent.userId)
        ),
        columns: { id: true },
      });

      return {
        ...intent,
        items: intentItems,
        buyerEmail: buyer?.emailVisibility === "direct" ? buyer.email : "",
        buyerName: buyer?.displayName ?? "Unknown",
        projectName: project?.name ?? "Unknown",
        threadId: thread?.id ?? null,
      };
    })
  );

  const buildTabHref = (
    nextTab: "active" | "archived",
    nextStatus: "all" | IntentStatus = statusFilter
  ) => {
    const params = new URLSearchParams();
    if (nextTab !== "active") params.set("tab", nextTab);
    if (nextStatus !== "all") params.set("status", nextStatus);
    const qs = params.toString();
    return qs ? `/seller/intents?${qs}` : "/seller/intents";
  };

  const archiveLabels = {
    archive: tSeller("archive"),
    unarchive: tSeller("unarchive"),
    archivedToast: tSeller("archivedToast"),
    unarchivedToast: tSeller("unarchivedToast"),
  };

  const pendingLabels = {
    accept: tSeller("accept"),
    decline: tSeller("decline"),
    declineWithNote: tSeller("declineWithNote"),
    noteOptional: tSeller("noteOptional"),
    cancel: tSeller("cancelDecline"),
    acceptedToast: tSeller("acceptedToast"),
    declinedToast: tSeller("declinedToast"),
  };

  return (
    <div>
      <h1 className="text-heading-2 mb-4">{t("intents")}</h1>

      {/* Tab row: Active / Archived */}
      <div className="mb-3 inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
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
                {id === "active"
                  ? tSeller("tabActive")
                  : tSeller("tabArchived")}
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

      {/* Status filter chips */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {(["all", ...STATUSES] as const).map((s) => {
          const isActive = s === statusFilter;
          return (
            <Link
              key={s}
              href={buildTabHref(tab, s)}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition-colors",
                isActive
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-background text-muted-foreground ring-border hover:text-foreground"
              )}
            >
              {s === "all"
                ? tSeller("filterAll")
                : tStatus(s as IntentStatus)}
            </Link>
          );
        })}
      </div>

      {enrichedIntents.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            tab === "archived"
              ? tSeller("emptyArchived")
              : tSeller("emptyActive")
          }
        />
      ) : (
        <div className="space-y-4">
          {enrichedIntents.map((intent) => {
            const status = intent.status as IntentStatus;
            const isFinalized =
              status === "accepted" ||
              status === "declined" ||
              status === "cancelled";
            return (
              <div
                key={intent.id}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3 transition-opacity",
                  intent.archivedAt && "opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {intent.buyerName}
                      {intent.buyerEmail ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          · {intent.buyerEmail}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {intent.projectName} ·{" "}
                      <LocalizedDateTime
                        value={intent.createdAt}
                        className="inline"
                      />
                    </p>
                    {intent.phone && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {intent.phone}
                      </p>
                    )}
                    {intent.pickupNotes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold">
                          {tIntent("pickupNotes")}:
                        </span>{" "}
                        {intent.pickupNotes}
                      </p>
                    )}
                    {intent.reviewerNote && (
                      <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/50">
                        <span className="font-semibold">
                          {tSeller("yourNote")}:
                        </span>{" "}
                        {intent.reviewerNote}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      STATUS_PILL[status]
                    )}
                  >
                    {tStatus(status)}
                  </span>
                </div>

                <ul className="space-y-0.5 text-sm">
                  {intent.items.map((item) => (
                    <li
                      key={item.itemId}
                      className="flex items-center gap-2"
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

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {intent.threadId && (
                    <Link
                      href={`/seller/messages/${intent.threadId}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {tSeller("messageBuyer")}
                    </Link>
                  )}
                  {isFinalized && (
                    <ArchiveButton
                      intentId={intent.id}
                      isArchived={Boolean(intent.archivedAt)}
                      labels={archiveLabels}
                    />
                  )}
                </div>

                {status === "submitted" && (
                  <div className="space-y-3 border-t pt-3">
                    <PendingIntentActions
                      intentId={intent.id}
                      labels={pendingLabels}
                    />
                    <ReserveItemsForm
                      intentId={intent.id}
                      items={intent.items}
                      labels={{
                        reserveSelected: tSeller("reserveSelected"),
                        selectItems: tSeller("selectItemsToReserve"),
                        reserving: tSeller("reserving"),
                        itemUnavailable: tSeller("itemUnavailable"),
                        reserved: tSeller("reservedToast"),
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
