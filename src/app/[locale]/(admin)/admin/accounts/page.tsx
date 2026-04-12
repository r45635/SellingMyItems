import { db } from "@/db";
import { profiles } from "@/db/schema";
import { count, desc } from "drizzle-orm";
import { ToggleActiveButton } from "./toggle-active-button";
import { Pagination } from "@/components/shared/pagination";

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
        role: profiles.role,
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
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {allProfiles.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{p.email}</td>
                <td className="px-4 py-3">{p.displayName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.role === "admin"
                        ? "text-red-600 font-semibold"
                        : p.role === "seller"
                          ? "text-blue-600"
                          : ""
                    }
                  >
                    {p.role}
                  </span>
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
                <td className="px-4 py-3">
                  {p.role !== "admin" && (
                    <ToggleActiveButton
                      profileId={p.id}
                      isActive={p.isActive}
                    />
                  )}
                </td>
              </tr>
            ))}
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
