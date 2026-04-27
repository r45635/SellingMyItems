import { db } from "@/db";
import { projects, sellerAccounts, profiles, items } from "@/db/schema";
import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { Pagination } from "@/components/shared/pagination";
import { ApprovalControls } from "./approval-controls";

const PAGE_SIZE = 20;

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, Number(pageParam) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Pending projects bubble to the top so admins triage them first; within
  // each status group we keep newest-first.
  const statusOrder = sql<number>`
    case ${projects.publishStatus}
      when 'pending' then 0
      when 'rejected' then 1
      when 'draft' then 2
      when 'approved' then 3
    end
  `;

  const [allProjects, totalCountResult] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        isPublic: projects.isPublic,
        publishStatus: projects.publishStatus,
        reviewerNote: projects.reviewerNote,
        submittedAt: projects.submittedAt,
        deletedAt: projects.deletedAt,
        createdAt: projects.createdAt,
        sellerEmail: profiles.email,
      })
      .from(projects)
      .innerJoin(sellerAccounts, eq(projects.sellerId, sellerAccounts.id))
      .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
      .orderBy(statusOrder, desc(projects.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: count() }).from(projects),
  ]);

  const totalItems = Number(totalCountResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  const itemCounts = await db
    .select({
      projectId: items.projectId,
      count: count(),
    })
    .from(items)
    .where(isNull(items.deletedAt))
    .groupBy(items.projectId);

  const itemCountMap = new Map(itemCounts.map((r) => [r.projectId, r.count]));

  const pendingCount = allProjects.filter(
    (p) => p.publishStatus === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Projects management</h1>
        <p className="text-muted-foreground mt-1">
          {totalItems} project{totalItems > 1 ? "s" : ""} total
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              {pendingCount} pending review
            </span>
          )}
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Seller</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
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
                <td className="px-4 py-3 font-mono text-xs">{p.sellerEmail}</td>
                <td className="px-4 py-3">{itemCountMap.get(p.id) ?? 0}</td>
                <td className="px-4 py-3">
                  {p.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Deleted
                    </span>
                  ) : (
                    <PublishStatusPill status={p.publishStatus} />
                  )}
                  {p.publishStatus === "rejected" && p.reviewerNote && (
                    <p className="mt-1 max-w-xs text-[11px] text-muted-foreground italic line-clamp-2">
                      “{p.reviewerNote}”
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {p.submittedAt
                    ? new Date(p.submittedAt).toLocaleDateString("en-US")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {!p.deletedAt && (
                    <ApprovalControls
                      projectId={p.id}
                      status={p.publishStatus}
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

function PublishStatusPill({
  status,
}: {
  status: "draft" | "pending" | "approved" | "rejected";
}) {
  const styles: Record<typeof status, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  const label: Record<typeof status, string> = {
    draft: "Draft",
    pending: "Pending review",
    approved: "Approved · public",
    rejected: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {label[status]}
    </span>
  );
}
