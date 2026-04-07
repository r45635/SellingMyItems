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
import {
  Users,
  Store,
  FolderOpen,
  Package,
  MessageSquare,
  ShoppingCart,
} from "lucide-react";

export default async function AdminOverviewPage() {
  const [
    totalProfiles,
    purchaserCount,
    sellerCount,
    activeProfiles,
    inactiveProfiles,
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
    db
      .select({ value: count() })
      .from(profiles)
      .where(eq(profiles.role, "purchaser")),
    db
      .select({ value: count() })
      .from(profiles)
      .where(eq(profiles.role, "seller")),
    db
      .select({ value: count() })
      .from(profiles)
      .where(eq(profiles.isActive, true)),
    db
      .select({ value: count() })
      .from(profiles)
      .where(eq(profiles.isActive, false)),
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
      .select({
        status: items.status,
        value: count(),
      })
      .from(items)
      .groupBy(items.status),
    db
      .select({
        currency: items.currency,
        total: sql<number>`COALESCE(SUM(${items.price}), 0)`,
      })
      .from(items)
      .where(isNull(items.deletedAt))
      .groupBy(items.currency),
    db.select({ value: count() }).from(buyerIntents),
    db.select({ value: count() }).from(conversationThreads),
  ]);

  const statusMap = new Map(
    itemsByStatus.map((r) => [r.status, r.value])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>
        <p className="text-muted-foreground mt-1">
          Statistiques de la plateforme
        </p>
      </div>

      {/* Profiles */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Comptes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total comptes" value={totalProfiles[0].value} />
          <StatCard label="Acheteurs" value={purchaserCount[0].value} />
          <StatCard label="Vendeurs" value={sellerCount[0].value} />
          <StatCard
            label="Actifs / Inactifs"
            value={`${activeProfiles[0].value} / ${inactiveProfiles[0].value}`}
          />
        </div>
      </section>

      {/* Projects */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" /> Projets
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total projets" value={totalProjects[0].value} />
          <StatCard label="Publics" value={publicProjects[0].value} />
          <StatCard
            label="Brouillons"
            value={
              totalProjects[0].value -
              publicProjects[0].value -
              deletedProjects[0].value
            }
          />
          <StatCard label="Supprimés" value={deletedProjects[0].value} />
        </div>
      </section>

      {/* Items */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" /> Articles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total articles" value={totalItems[0].value} />
          <StatCard
            label="Disponibles"
            value={statusMap.get("available") ?? 0}
          />
          <StatCard label="Réservés" value={statusMap.get("reserved") ?? 0} />
          <StatCard label="Vendus" value={statusMap.get("sold") ?? 0} />
          <StatCard label="Masqués" value={statusMap.get("hidden") ?? 0} />
        </div>
      </section>

      {/* Value */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Store className="h-5 w-5" /> Valeur catalogue
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {totalValue.map((row) => (
            <StatCard
              key={row.currency}
              label={row.currency}
              value={new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: row.currency,
                minimumFractionDigits: 0,
              }).format(Number(row.total) / 100)}
            />
          ))}
          {totalValue.length === 0 && (
            <StatCard label="Aucune valeur" value="—" />
          )}
        </div>
      </section>

      {/* Engagement */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Engagement
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Intentions d'achat" value={totalIntents[0].value} />
          <StatCard label="Conversations" value={totalThreads[0].value} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{String(value)}</p>
    </div>
  );
}
