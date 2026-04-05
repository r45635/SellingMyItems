import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { MapPin, ArrowRight, Tag, Package } from "lucide-react";
import { SmiLogo } from "@/components/shared/smi-logo";

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
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-orange-50/60 to-background py-16 md:py-28 lg:py-36">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-6 text-center">
            <SmiLogo size="lg" showText={false} className="mb-2" />
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              {t("hero")}
            </h1>
            <p className="mx-auto max-w-[600px] text-lg text-muted-foreground md:text-xl">
              {t("subtitle")}
            </p>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg transition-all hover:bg-foreground/90 hover:shadow-xl"
            >
              {t("browseProjects")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-orange-400/5 blur-3xl" />
      </section>

      {/* Sign-in prompt */}
      <section className="border-b bg-muted/40 py-8">
        <div className="container px-4 md:px-6">
          <p className="text-center text-base sm:text-sm text-muted-foreground max-w-[600px] mx-auto">
            {t("signInPrompt")}
          </p>
        </div>
      </section>

      {/* Projects */}
      <section className="py-12 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-2 mb-8">
            <Package className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">{t("browseProjects")}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicProjects.length === 0 ? (
              <div className="col-span-full rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p>Projects will appear here</p>
              </div>
            ) : (
              publicProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-orange-200"
                >
                  <h3 className="text-lg font-semibold group-hover:text-orange-600 transition-colors">
                    {project.name}
                  </h3>
                  {project.cityArea && (
                    <div className="flex items-center gap-1.5 text-base sm:text-sm text-muted-foreground mt-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{project.cityArea}</span>
                    </div>
                  )}
                  {project.description && (
                    <p className="text-base sm:text-sm text-muted-foreground mt-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-base sm:text-sm font-medium text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    View items <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
