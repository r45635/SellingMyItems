import { db } from "@/db";
import {
  profiles,
  sellerAccounts,
  projects,
  items,
  buyerIntents,
  conversationThreads,
} from "@/db/schema";
import { count, eq, isNull, isNotNull, and, sql } from "drizzle-orm";
import { cn } from "@/lib/utils";

type Accent = "green" | "red" | "blue" | "purple" | "amber" | "neutral";

const ACCENT_STYLES: Record<
  Accent,
  { bg: string; border: string; text: string }
> = {
  green: { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-900", text: "text-green-700 dark:text-green-400" },
  red: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-900", text: "text-red-700 dark:text-red-400" },
  blue: { bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200 dark:border-sky-900", text: "text-sky-700 dark:text-sky-400" },
  purple: { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-900", text: "text-violet-700 dark:text-violet-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900", text: "text-amber-700 dark:text-amber-400" },
  neutral: { bg: "bg-card", border: "border-border", text: "text-foreground" },
};

function formatCurrency(value: number, currency: string = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export default async function AdminOverviewPage() {
  const [
    totalProfiles,
    sellerCount,
    activeProfiles,
    inactiveProfiles,
    adminCount,
    totalProjects,
    publicProjects,
    deletedProjects,
    totalItems,
    itemsByStatus,
    totalValue,
    totalIntents,
    totalThreads,
  ] = await Promise.all([
    db.select({ value: count() }).from(profiles),
    db.select({ value: count() }).from(sellerAccounts),
    db.select({ value: count() }).from(profiles).where(eq(profiles.isActive, true)),
    db.select({ value: count() }).from(profiles).where(eq(profiles.isActive, false)),
    db.select({ value: count() }).from(profiles).where(eq(profiles.isAdmin, true)),
    db.select({ value: count() }).from(projects),
    db
      .select({ value: count() })
      .from(projects)
      .where(and(eq(projects.isPublic, true), isNull(projects.deletedAt))),
    db
      .select({ value: count() })
      .from(projects)
      .where(isNotNull(projects.deletedAt)),
    db.select({ value: count() }).from(items),
    db
      .select({ status: items.status, value: count() })
      .from(items)
      .where(isNull(items.deletedAt))
      .groupBy(items.status),
    db
      .select({
        currency: items.currency,
        total: sql<number>`COALESCE(SUM(${items.price}), 0)`,
      })
      .from(items)
      .where(and(isNull(items.deletedAt), eq(items.status, "available")))
      .groupBy(items.currency),
    db.select({ value: count() }).from(buyerIntents),
    db.select({ value: count() }).from(conversationThreads),
  ]);

  const statusMap = new Map(itemsByStatus.map((r) => [r.status, r.value]));

  const availableCount = statusMap.get("available") ?? 0;
  const reservedCount = statusMap.get("reserved") ?? 0;
  const soldCount = statusMap.get("sold") ?? 0;
  const hiddenCount = statusMap.get("hidden") ?? 0;
  const totalNonDeletedItems =
    availableCount + reservedCount + soldCount + hiddenCount;

  const draftProjectsCount =
    totalProjects[0].value -
    publicProjects[0].value -
    deletedProjects[0].value;

  // Hero pick: prefer USD if present, otherwise the currency with the largest
  // total. Other currencies surface as small chips below.
  const heroRow =
    totalValue.find((r) => r.currency === "USD") ??
    [...totalValue].sort((a, b) => Number(b.total) - Number(a.total))[0];
  const heroValue = heroRow ? Number(heroRow.total) : 0;
  const heroCurrency = heroRow?.currency ?? "USD";
  const otherCurrencies = totalValue.filter(
    (r) => r.currency !== heroCurrency
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-eyebrow text-orange-500 mb-1">Admin</p>
        <h1 className="text-heading-2">Platform Overview</h1>
      </div>

      {/* Hero metric — catalog value */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 text-white p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between shadow-lg shadow-orange-200 dark:shadow-orange-950">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-2">
            Catalog value ({heroCurrency})
          </p>
          <p className="text-5xl font-extrabold tracking-tight font-heading">
            {formatCurrency(heroValue, heroCurrency)}
          </p>
          <p className="text-sm text-white/70 mt-2">
            Across {availableCount} available item{availableCount === 1 ? "" : "s"}
          </p>
        </div>
        {otherCurrencies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {otherCurrencies.map((row) => (
              <div
                key={row.currency}
                className="rounded-lg bg-white/10 backdrop-blur px-3 py-2 text-sm"
              >
                <span className="font-bold">
                  {formatCurrency(Number(row.total), row.currency)}
                </span>
                <span className="text-white/60 text-xs ml-1.5">
                  {row.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Accounts */}
        <Section title="Accounts">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total" value={totalProfiles[0].value} accent="purple" />
            <StatCard label="Sellers" value={sellerCount[0].value} accent="purple" />
            <StatCard label="Active" value={activeProfiles[0].value} accent="green" />
            <StatCard label="Inactive" value={inactiveProfiles[0].value} accent="red" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {adminCount[0].value} admin{adminCount[0].value === 1 ? "" : "s"} · everyone signed in is a buyer
          </p>
        </Section>

        {/* Projects */}
        <Section title="Projects">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total" value={totalProjects[0].value} accent="neutral" />
            <StatCard label="Public" value={publicProjects[0].value} accent="blue" />
            <StatCard label="Draft" value={draftProjectsCount} accent="amber" />
            <StatCard label="Deleted" value={deletedProjects[0].value} accent="red" />
          </div>
        </Section>

        {/* Items — full width with status breakdown bar */}
        <Section title="Items" className="md:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total" value={totalItems[0].value} accent="neutral" />
            <StatCard label="Available" value={availableCount} accent="green" />
            <StatCard label="Reserved" value={reservedCount} accent="red" />
            <StatCard label="Sold" value={soldCount} accent="neutral" />
            <StatCard label="Hidden" value={hiddenCount} accent="amber" />
          </div>
          {totalNonDeletedItems > 0 && (
            <div className="mt-4">
              <div className="flex rounded-full overflow-hidden h-2 bg-border gap-px">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{
                    width: `${(availableCount / totalNonDeletedItems) * 100}%`,
                  }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{
                    width: `${(reservedCount / totalNonDeletedItems) * 100}%`,
                  }}
                />
                <div
                  className="bg-gray-400 transition-all"
                  style={{
                    width: `${(soldCount / totalNonDeletedItems) * 100}%`,
                  }}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{
                    width: `${(hiddenCount / totalNonDeletedItems) * 100}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-bold text-emerald-600">{availableCount}</span> Available
                </span>
                <span>
                  <span className="font-bold text-red-600">{reservedCount}</span> Reserved
                </span>
                <span>
                  <span className="font-bold text-gray-500">{soldCount}</span> Sold
                </span>
                <span>
                  <span className="font-bold text-amber-600">{hiddenCount}</span> Hidden
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* Engagement */}
        <Section title="Engagement" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Purchase intents"
              value={totalIntents[0].value}
              accent="purple"
            />
            <StatCard
              label="Conversations"
              value={totalThreads[0].value}
              accent="blue"
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        className
      )}
    >
      <h2 className="text-eyebrow text-muted-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  accent?: Accent;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div
      className={cn(
        "border rounded-xl p-3 flex-1",
        styles.bg,
        styles.border
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </p>
      <p className={cn("text-2xl font-extrabold font-heading", styles.text)}>
        {String(value)}
      </p>
    </div>
  );
}
