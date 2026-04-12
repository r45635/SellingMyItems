import { db } from "@/db";
import { projects, sellerAccounts, profiles, items } from "@/db/schema";
import { count, desc, eq, isNull } from "drizzle-orm";
import { TogglePublicButton } from "./toggle-public-button";
import { Pagination } from "@/components/shared/pagination";

const PAGE_SIZE = 20;

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, Number(pageParam) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [allProjects, totalCountResult] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        isPublic: projects.isPublic,
        deletedAt: projects.deletedAt,
        createdAt: projects.createdAt,
        sellerEmail: profiles.email,
      })
      .from(projects)
      .innerJoin(sellerAccounts, eq(projects.sellerId, sellerAccounts.id))
      .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
      .orderBy(desc(projects.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: count() }).from(projects),
  ]);

  const totalItems = Number(totalCountResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  // Get item counts per project
  const itemCounts = await db
    .select({
      projectId: items.projectId,
      count: count(),
    })
    .from(items)
    .where(isNull(items.deletedAt))
    .groupBy(items.projectId);

  const itemCountMap = new Map(
    itemCounts.map((r) => [r.projectId, r.count])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Projects management</h1>
        <p className="text-muted-foreground mt-1">
          {totalItems} project{totalItems > 1 ? "s" : ""} total
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Seller</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Visibility</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {allProjects.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      /{p.slug}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {p.sellerEmail}
                </td>
                <td className="px-4 py-3">{itemCountMap.get(p.id) ?? 0}</td>
                <td className="px-4 py-3">
                  {p.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Deleted
                    </span>
                  ) : p.isPublic ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(p.createdAt).toLocaleDateString("en-US")}
                </td>
                <td className="px-4 py-3">
                  {!p.deletedAt && (
                    <TogglePublicButton
                      projectId={p.id}
                      isPublic={p.isPublic}
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
