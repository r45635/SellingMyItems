"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { revokeItemShareLinkAction } from "@/features/items/share-actions";

interface Props {
  linkId: string;
}

export function RevokeShareLinkButton({ linkId }: Props) {
  const t = useTranslations("share");
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (!confirm(t("revokeConfirm"))) return;
    startTransition(async () => {
      const result = await revokeItemShareLinkAction(linkId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("revokeSuccess"));
      }
    });
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={isPending}
      className="inline-flex h-7 items-center justify-center rounded-md border border-destructive/50 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
    >
      {t("revokeLink")}
    </button>
  );
}
