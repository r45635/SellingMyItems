import type { MetadataRoute } from "next";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { siteConfig } from "@/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  // Static pages — one entry per locale
  const staticRoutes: MetadataRoute.Sitemap = siteConfig.locales.flatMap(
    (locale) => [
      {
        url: `${baseUrl}/${locale}`,
        changeFrequency: "daily" as const,
        priority: 1,
      },
    ]
  );

  let seoProjects: Array<{ slug: string; updatedAt: Date | null }> = [];

  // Build-time environments (CI/Docker build stage) may not have a resolvable
  // DB host. In that case we still want a valid sitemap with static routes.
  try {
    seoProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.isPublic, true),
        eq(projects.publishStatus, "approved"),
        eq(projects.isSeoIndexable, true),
        isNull(projects.deletedAt)
      ),
      columns: { slug: true, updatedAt: true },
    });
  } catch (error) {
    console.warn("[sitemap] DB unavailable, returning static routes only", error);
  }

  const projectRoutes: MetadataRoute.Sitemap = seoProjects.flatMap(
    (project) =>
      siteConfig.locales.map((locale) => ({
        url: `${baseUrl}/${locale}/project/${project.slug}`,
        lastModified: project.updatedAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))
  );

  return [...staticRoutes, ...projectRoutes];
}
