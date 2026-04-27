"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2, Clock, FileEdit, XCircle } from "lucide-react";
import { submitProjectForReviewAction } from "@/features/projects/actions";

export type PublishStatus = "draft" | "pending" | "approved" | "rejected";

const STATUS_STYLES: Record<PublishStatus, { bg: string; icon: typeof Clock }> = {
  draft: {
    bg: "bg-muted text-muted-foreground border border-border",
    icon: FileEdit,
  },
  pending: {
    bg: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
    icon: Clock,
  },
  approved: {
    bg: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
    icon: CheckCircle2,
  },
  rejected: {
    bg: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900",
    icon: XCircle,
  },
};

export function PublishStatusBadge({ status }: { status: PublishStatus }) {
  const t = useTranslations("seller");
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg}`}
    >
      <Icon className="h-3 w-3" />
      {t(`publishStatus.${status}`)}
    </span>
  );
}

export function SubmitForReviewButton({
  projectIdOrSlug,
  status,
  reviewerNote,
}: {
  projectIdOrSlug: string;
  status: PublishStatus;
  reviewerNote?: string | null;
}) {
  const t = useTranslations("seller");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitProjectForReviewAction(projectIdOrSlug);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("publishStatus.submittedToast"));
      router.refresh();
    });
  }

  if (status === "approved") {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-400">
        {t("publishStatus.approvedHint")}
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        {t("publishStatus.pendingHint")}
      </p>
    );
  }

  // draft or rejected → user can submit (or re-submit)
  return (
    <div className="space-y-1.5">
      {status === "rejected" && reviewerNote && (
        <p className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-2.5 py-1.5 text-xs text-red-800 dark:text-red-300">
          <span className="font-semibold">{t("publishStatus.rejectedReason")}:</span>{" "}
          {reviewerNote}
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {status === "rejected"
          ? t("publishStatus.resubmit")
          : t("publishStatus.submit")}
      </button>
    </div>
  );
}
