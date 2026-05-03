import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/db";
import { itemShareLinks, items, projects } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Lock, Share2 } from "lucide-react";
import { claimShareLinkAction } from "@/features/items/share-actions";
import Image from "next/image";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";
import { siteConfig } from "@/config";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const row = await fetchShareLinkTeaser(token);
  if (!row) return { title: "Shared item" };
  return {
    title: `${row.itemTitle} — ${row.projectName}`,
    robots: { index: false, follow: false },
  };
}

async function fetchShareLinkTeaser(token: string) {
  const rows = await db
    .select({
      linkId: itemShareLinks.id,
      expiresAt: itemShareLinks.expiresAt,
      revokedAt: itemShareLinks.revokedAt,
      itemId: items.id,
      itemTitle: items.title,
      itemPrice: items.price,
      itemCurrency: items.currency,
      itemCoverImageUrl: items.coverImageUrl,
      itemStatus: items.status,
      itemDeletedAt: items.deletedAt,
      projectId: projects.id,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectCityArea: projects.cityArea,
      projectIsPublic: projects.isPublic,
      projectPublishStatus: projects.publishStatus,
      projectDeletedAt: projects.deletedAt,
    })
    .from(itemShareLinks)
    .innerJoin(items, eq(itemShareLinks.itemId, items.id))
    .innerJoin(projects, eq(itemShareLinks.projectId, projects.id))
    .where(eq(itemShareLinks.token, token))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0];
}

export default async function ShareTokenPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token, locale } = await params;
  const t = await getTranslations("share");
  const user = await getUser();

  const row = await fetchShareLinkTeaser(token);

  // Validate link existence and item/project availability
  const isInvalid =
    !row ||
    row.revokedAt !== null ||
    row.expiresAt < new Date() ||
    row.itemDeletedAt !== null ||
    row.projectDeletedAt !== null ||
    !row.projectIsPublic ||
    row.projectPublishStatus !== "approved" ||
    row.itemStatus === "hidden";

  if (isInvalid) {
    return (
      <div className="container px-4 md:px-6 py-20 max-w-lg mx-auto text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 ring-8 ring-red-50 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-950/20">
          <Share2 className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{t("invalidLink")}</h1>
          <p className="text-sm text-muted-foreground">{t("invalidLinkDesc")}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
        >
          {t("backToHome")}
        </Link>
      </div>
    );
  }

  // Authenticated user: claim access and redirect to item
  if (user) {
    const result = await claimShareLinkAction(token);
    if ("projectSlug" in result) {
      redirect(`/${locale}/project/${result.projectSlug}/item/${result.itemId}`);
    }
    // Claim failed (expired/revoked race) — fall through to show error
    return (
      <div className="container px-4 md:px-6 py-20 max-w-lg mx-auto text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 ring-8 ring-red-50 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-950/20">
          <Share2 className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{t("invalidLink")}</h1>
          <p className="text-sm text-muted-foreground">{t("invalidLinkDesc")}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
        >
          {t("backToHome")}
        </Link>
      </div>
    );
  }

  // Unauthenticated: show teaser
  const formattedPrice =
    row.itemPrice != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: row.itemCurrency ?? "USD",
          maximumFractionDigits: row.itemPrice % 1 === 0 ? 0 : 2,
        }).format(row.itemPrice)
      : null;

  const returnTo = `/share/${token}`;

  return (
    <div className="container px-4 md:px-6 py-10 max-w-2xl mx-auto space-y-6 animate-fade-up">
      {/* Item teaser card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {row.itemCoverImageUrl ? (
          <div className="relative aspect-[4/3] w-full bg-muted">
            <Image
              src={row.itemCoverImageUrl}
              alt={row.itemTitle}
              fill
              className="object-cover"
              placeholder="blur"
              blurDataURL={BLUR_PLACEHOLDER}
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>
        ) : (
          <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center">
            <Share2 className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {row.projectName}
            {row.projectCityArea ? ` · ${row.projectCityArea}` : ""}
          </p>
          <h1 className="text-xl font-extrabold">{row.itemTitle}</h1>
          {formattedPrice && (
            <p className="text-2xl font-extrabold text-orange-600">{formattedPrice}</p>
          )}
        </div>
      </div>

      {/* Auth CTA */}
      <div className="rounded-2xl border bg-gradient-to-b from-orange-50/60 to-card p-8 text-center space-y-4 dark:from-orange-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 ring-8 ring-orange-50/60 dark:bg-orange-950/50 dark:text-orange-400 dark:ring-orange-950/20">
          <Lock className="h-5 w-5" />
        </div>
        <div className="space-y-1 mx-auto max-w-md">
          <p className="font-semibold">{t("loginToView")}</p>
          <p className="text-sm text-muted-foreground">{t("loginBody")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
          >
            {t("loginToView")}
          </Link>
          <Link
            href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-5 text-sm font-semibold hover:bg-muted transition-all"
          >
            {t("createAccountToView")}
          </Link>
        </div>
      </div>
    </div>
  );
}
