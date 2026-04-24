import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Lock, Send, Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationThreads,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { startConversationAction } from "@/features/messages/actions";

export default async function ComposeMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("messages");

  if (!projectId) notFound();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
  });
  if (!project) notFound();

  const existing = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.projectId, projectId),
      eq(conversationThreads.buyerId, user.id)
    ),
    columns: { id: true },
  });
  if (existing) {
    redirect(`/messages/${existing.id}`);
  }

  const sellerRow = await db
    .select({
      displayName: profiles.displayName,
      emailVisibility: profiles.emailVisibility,
      email: profiles.email,
    })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(eq(sellerAccounts.id, project.sellerId))
    .limit(1);
  const seller = sellerRow[0] ?? null;

  return (
    <div className="container px-4 md:px-6 py-6 md:py-8 max-w-2xl">
      <Link
        href={`/project/${project.slug}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToProject")}
      </Link>

      <div className="mt-4 rounded-2xl border bg-gradient-to-br from-orange-50/60 to-background p-5 dark:from-orange-950/20">
        <p className="text-eyebrow">{t("conversation")}</p>
        <h1 className="text-heading-3 mt-1 inline-flex items-center gap-1.5">
          <Package className="h-5 w-5 text-orange-500" />
          {project.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("contactSellerIntro", {
            project: project.name,
            seller: seller?.displayName ?? t("seller"),
          })}
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{t("privacyNotice")}</span>
        </div>
      </div>

      <form action={startConversationAction} className="mt-5 space-y-3">
        <input type="hidden" name="projectId" value={project.id} />
        <div className="rounded-2xl border bg-card p-3 shadow-sm transition-shadow focus-within:border-emerald-300 focus-within:shadow focus-within:ring-2 focus-within:ring-emerald-500/15 dark:focus-within:border-emerald-800">
          <textarea
            name="body"
            required
            rows={5}
            placeholder={t("composePlaceholder")}
            className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              name="sendCopy"
              className="rounded border-gray-300"
            />
            {t("sendCopy")}
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Send className="h-4 w-4" />
            {t("sendMessage")}
          </button>
        </div>
      </form>
    </div>
  );
}
