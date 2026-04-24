import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationThreads,
  profiles,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  // If a thread already exists for this (buyer, project) pair, skip compose
  // and take the user directly to the existing conversation.
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
    <div className="container px-4 md:px-6 py-8 max-w-2xl space-y-4">
      <Link
        href={`/project/${project.slug}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToProject")}
      </Link>

      <div className="rounded-xl border bg-card p-5">
        <h1 className="text-heading-3">{t("contactSellerTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("contactSellerIntro", {
            project: project.name,
            seller: seller?.displayName ?? t("seller"),
          })}
        </p>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{t("privacyNotice")}</span>
        </div>

        <form action={startConversationAction} className="mt-5 space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <Textarea
            name="body"
            required
            rows={6}
            placeholder={t("composePlaceholder")}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" name="sendCopy" className="rounded border-gray-300" />
            {t("sendCopy")}
          </label>
          <Button type="submit" size="lg">
            {t("sendMessage")}
          </Button>
        </form>
      </div>
    </div>
  );
}
