import { db } from "@/db";
import { projects, sellerAccounts, profiles, items } from "@/db/schema";
import { count, desc, eq, isNull } from "drizzle-orm";
import { TogglePublicButton } from "./toggle-public-button";

export default async function AdminProjectsPage() {
  const allProjects = await db
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
    .orderBy(desc(projects.createdAt));

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
        <h1 className="text-2xl font-bold">Gestion des projets</h1>
        <p className="text-muted-foreground mt-1">
          {allProjects.length} projet{allProjects.length > 1 ? "s" : ""} au
          total
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Projet</th>
              <th className="px-4 py-3 font-medium">Vendeur</th>
              <th className="px-4 py-3 font-medium">Articles</th>
              <th className="px-4 py-3 font-medium">Visibilité</th>
              <th className="px-4 py-3 font-medium">Créé le</th>
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
                      Supprimé
                    </span>
                  ) : p.isPublic ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      Brouillon
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(p.createdAt).toLocaleDateString("fr-FR")}
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
    </div>
  );
}
