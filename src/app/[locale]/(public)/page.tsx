import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function HomePage() {
  const t = await getTranslations("home");
  const publicProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      cityArea: projects.cityArea,
      description: projects.description,
    })
    .from(projects)
    .where(eq(projects.isPublic, true))
    .orderBy(desc(projects.createdAt))
    .limit(12);

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
              {t("hero")}
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              {t("subtitle")}
            </p>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
              >
                {t("browseProjects")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sign-in prompt for guests */}
      <section className="w-full py-12 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <p className="text-muted-foreground max-w-[600px]">
              {t("signInPrompt")}
            </p>
          </div>
        </div>
      </section>

      {/* Projects will be listed here */}
      <section className="w-full py-12">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {publicProjects.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                Projects will appear here
              </div>
            ) : (
              publicProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{project.cityArea}</p>
                  {project.description ? (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                      {project.description}
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
