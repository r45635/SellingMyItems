"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  archiveIntentAction,
  unarchiveIntentAction,
  updateIntentStatusAction,
} from "@/features/intents/actions";
import { Archive, ArchiveRestore, Check, X } from "lucide-react";

type Labels = {
  accept: string;
  decline: string;
  declineWithNote: string;
  noteOptional: string;
  cancel: string;
  archive: string;
  unarchive: string;
  acceptedToast: string;
  declinedToast: string;
  archivedToast: string;
  unarchivedToast: string;
};

/**
 * Pending intent: Accept / Decline (with optional reviewer note).
 * The note expands inline below the button row when the user clicks
 * Decline, mirroring the project rejection UX.
 */
export function PendingIntentActions({
  intentId,
  labels,
}: {
  intentId: string;
  labels: Pick<
    Labels,
    | "accept"
    | "decline"
    | "declineWithNote"
    | "noteOptional"
    | "cancel"
    | "acceptedToast"
    | "declinedToast"
  >;
}) {
  const [isPending, startTransition] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [note, setNote] = useState("");

  function accept() {
    startTransition(async () => {
      await updateIntentStatusAction(intentId, "accepted");
      toast.success(labels.acceptedToast);
    });
  }

  function decline() {
    startTransition(async () => {
      await updateIntentStatusAction(intentId, "declined", note || undefined);
      toast.success(labels.declinedToast);
      setShowDecline(false);
      setNote("");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={accept}
          disabled={isPending}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          {labels.accept}
        </Button>
        {!showDecline ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowDecline(true)}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {labels.decline}
          </Button>
        ) : null}
      </div>
      {showDecline && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
          <label className="block text-xs font-medium text-red-800 dark:text-red-300">
            {labels.declineWithNote}
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={2}
            maxLength={500}
            placeholder={labels.noteOptional}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={decline}
              disabled={isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {labels.decline}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowDecline(false);
                setNote("");
              }}
              disabled={isPending}
            >
              {labels.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ArchiveButton({
  intentId,
  isArchived,
  labels,
}: {
  intentId: string;
  isArchived: boolean;
  labels: Pick<
    Labels,
    "archive" | "unarchive" | "archivedToast" | "unarchivedToast"
  >;
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
