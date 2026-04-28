"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  archiveIntentAction,
  cancelIntentAction,
  unarchiveIntentAction,
} from "@/features/intents/actions";
import { Archive, ArchiveRestore, Ban } from "lucide-react";

export function CancelIntentButton({
  intentId,
  labels,
}: {
  intentId: string;
  labels: { cancel: string; confirm: string; toast: string };
}) {
  const [isPending, startTransition] = useTransition();
  function onClick() {
    if (!confirm(labels.confirm)) return;
    startTransition(async () => {
      const res = await cancelIntentAction(intentId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(labels.toast);
    });
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={isPending}
      className="text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
    >
      <Ban className="h-3.5 w-3.5 mr-1" />
      {labels.cancel}
    </Button>
  );
}

export function BuyerArchiveButton({
  intentId,
  isArchived,
  labels,
}: {
  intentId: string;
  isArchived: boolean;
  labels: {
    archive: string;
    unarchive: string;
    archivedToast: string;
    unarchivedToast: string;
  };
}) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (isArchived) {
        await unarchiveIntentAction(intentId);
        toast.success(labels.unarchivedToast);
      } else {
        await archiveIntentAction(intentId);
        toast.success(labels.archivedToast);
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={toggle}
      disabled={isPending}
      className="text-muted-foreground hover:text-foreground"
    >
      {isArchived ? (
        <>
          <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
          {labels.unarchive}
        </>
      ) : (
        <>
          <Archive className="h-3.5 w-3.5 mr-1" />
          {labels.archive}
        </>
      )}
    </Button>
  );
}
