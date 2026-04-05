import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { db } from "@/db";
import { items, projectCategories, projects } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, slug),
      eq(projects.isPublic, true),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    notFound();
  }

  const categories = await db
    .select({ id: projectCategories.id, name: projectCategories.name })
    .from(projectCategories)
    .where(eq(projectCategories.projectId, project.id))
    .orderBy(asc(projectCategories.sortOrder), asc(projectCategories.name));

  const projectItems = await db
    .select({
      id: items.id,
      title: items.title,
      coverImageUrl: items.coverImageUrl,
      status: items.status,
    })
    .from(items)
    .where(and(eq(items.projectId, project.id), isNull(items.deletedAt)))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));

  return (
    <div className="container px-4 md:px-6 py-8">
      {/* Project Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <MapPin className="h-4 w-4" />
          <span>{project.cityArea}</span>
        </div>
        {project.description && (
          <p className="text-muted-foreground max-w-2xl">
            {project.description}
          </p>
        )}
        {categories.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {categories.map((category) => (
              <Badge key={category.id} variant="outline">
                {category.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Items Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {projectItems.map((item) => (
          <ItemTeaserCard
            key={item.id}
            title={item.title}
            coverImageUrl={item.coverImageUrl}
            status={item.status}
            href={`/project/${slug}/item/${item.id}`}
          />
        ))}
      </div>

      {projectItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No items yet
        </div>
      )}
    </div>
  );
}
