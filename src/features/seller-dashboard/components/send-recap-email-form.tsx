"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { sendReservationRecapAction } from "@/features/seller-dashboard/actions";
import { toast } from "sonner";

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
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendReservationRecapAction(
        projectId,
        buyerUserId,
        message,
        locale
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("recapEmailSent"));
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        {t("recapEmailSent")}
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
