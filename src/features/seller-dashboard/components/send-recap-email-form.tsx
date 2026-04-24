"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { sendReservationRecapAction } from "@/features/seller-dashboard/actions";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

export function SendRecapEmailForm({
  projectId,
  buyerUserId,
  buyerName,
  locale,
}: {
  projectId: string;
  buyerUserId: string;
  buyerName: string;
  locale: string;
}) {
  const t = useTranslations("seller");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sentThreadId, setSentThreadId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendReservationRecapAction(
        projectId,
        buyerUserId,
        message,
        locale
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (result.success) {
        if ("emailError" in result && result.emailError) {
          toast.warning(result.emailError);
        } else {
          toast.success(t("recapEmailSent"));
        }
        if (result.threadId) {
          setSentThreadId(result.threadId);
        }
        router.refresh();
      }
    });
  }

  if (sentThreadId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {t("recapEmailSent")}
        </div>
        <Link
          href={`/seller/messages/${sentThreadId}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          {t("openConversation")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("recapEmailPlaceholder")}
        rows={3}
        className="resize-none text-sm"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Mail className="mr-2 h-4 w-4" />
        )}
        {t("sendRecapEmail", { name: buyerName })}
      </Button>
    </form>
  );
}
