import { db } from "@/db";
import { profiles } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function AdminAccountsPage() {
  const allProfiles = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      role: profiles.role,
      displayName: profiles.displayName,
      isActive: profiles.isActive,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .orderBy(desc(profiles.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestion des comptes</h1>
        <p className="text-muted-foreground mt-1">
          {allProfiles.length} compte{allProfiles.length > 1 ? "s" : ""} au
          total
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Créé le</th>
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
                    {p.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(p.createdAt).toLocaleDateString("fr-FR")}
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
    </div>
  );
}
