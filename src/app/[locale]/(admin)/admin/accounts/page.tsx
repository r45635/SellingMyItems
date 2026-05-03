import { db } from "@/db";
import { profiles, sellerAccounts, sessions } from "@/db/schema";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { ToggleActiveButton } from "./toggle-active-button";
import { Pagination } from "@/components/shared/pagination";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { Shield, Tag, ShoppingCart } from "lucide-react";

const PAGE_SIZE = 20;

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, Number(pageParam) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [allProfiles, totalCountResult] = await Promise.all([
    db
      .select({
        id: profiles.id,
        email: profiles.email,
        isAdmin: profiles.isAdmin,
        displayName: profiles.displayName,
        isActive: profiles.isActive,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: count() }).from(profiles),
  ]);

  // Which of the profiles on this page own an active sellerAccount —
  // used to render the seller capability badge.
  const pageUserIds = allProfiles.map((p) => p.id);
  const sellerSet = new Set<string>();
  const lastLoginMap = new Map<string, Date>();

  if (pageUserIds.length > 0) {
    const [sellerRows, lastLoginRows] = await Promise.all([
      db
        .select({ userId: sellerAccounts.userId })
        .from(sellerAccounts)
        .where(
          and(
            inArray(sellerAccounts.userId, pageUserIds),
            eq(sellerAccounts.isActive, true)
          )
        ),
      db
        .select({ userId: sessions.userId, lastLoginAt: max(sessions.createdAt) })
        .from(sessions)
        .where(inArray(sessions.userId, pageUserIds))
        .groupBy(sessions.userId),
    ]);

    for (const row of sellerRows) sellerSet.add(row.userId);
    for (const row of lastLoginRows) {
      if (row.lastLoginAt) lastLoginMap.set(row.userId, row.lastLoginAt);
    }
  }

  const totalItems = Number(totalCountResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounts management</h1>
        <p className="text-muted-foreground mt-1">
          {totalItems} account{totalItems > 1 ? "s" : ""} total
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Capabilities</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {allProfiles.map((p) => {
              const isSeller = sellerSet.has(p.id);
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{p.email}</td>
                  <td className="px-4 py-3">{p.displayName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50">
                        <ShoppingCart className="h-2.5 w-2.5" />
                        Buyer
                      </span>
                      {isSeller && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900/50">
                          <Tag className="h-2.5 w-2.5" />
                          Seller
                        </span>
                      )}
                      {p.isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/50">
                          <Shield className="h-2.5 w-2.5" />
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.isActive
                          ? "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
                          : "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                      }
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(p.createdAt).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {lastLoginMap.has(p.id) ? (
                      <LocalizedDateTime value={lastLoginMap.get(p.id)!} />
                    ) : (
                      <span className="italic">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!p.isAdmin && (
                      <ToggleActiveButton
                        profileId={p.id}
                        isActive={p.isActive}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
