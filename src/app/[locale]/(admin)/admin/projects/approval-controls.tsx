"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  approveProjectAction,
  rejectProjectAction,
} from "@/features/projects/actions";
import { toggleProjectPublicAction } from "@/features/admin-dashboard/actions";

type Status = "draft" | "pending" | "approved" | "rejected";

export function ApprovalControls({
  projectId,
  status,
  isPublic,
}: {
  projectId: string;
  status: Status;
  isPublic: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectingOpen, setRejectingOpen] = useState(false);
  const [note, setNote] = useState("");

  function handleApprove() {
    startTransition(async () => {
      const r = await approveProjectAction(projectId);
      if ("error" in r && r.error) toast.error(r.error);
      else {
        toast.success("Project approved");
        router.refresh();
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const r = await rejectProjectAction(projectId, note);
      if ("error" in r && r.error) toast.error(r.error);
      else {
        toast.success("Project rejected");
        setRejectingOpen(false);
        setNote("");
        router.refresh();
      }
    });
  }

  function handleTogglePublic() {
    startTransition(async () => {
      const r = await toggleProjectPublicAction(projectId);
      if ("error" in r && r.error) toast.error(r.error);
      else router.refresh();
    });
  }

  if (status === "pending" || status === "draft" || status === "rejected") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex h-7 items-center gap-1 rounded bg-emerald-600 px-2 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Approve
          </button>
          <button
            type="button"
            onClick={() => setRejectingOpen((v) => !v)}
            disabled={isPending}
            className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] font-medium hover:bg-muted"
          >
            <XCircle className="h-3 w-3" />
            Reject
          </button>
        </div>
        {rejectingOpen && (
          <div className="space-y-1.5">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason (optional, shared with seller)"
              rows={2}
              maxLength={500}
              className="w-full rounded border bg-background px-2 py-1 text-[11px]"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending}
                className="inline-flex h-6 items-center rounded bg-red-600 px-2 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Confirm reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingOpen(false);
                  setNote("");
                }}
                className="inline-flex h-6 items-center rounded border px-2 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // status === "approved" — let admin toggle isPublic for emergency unpublish
  return (
    <button
      type="button"
      onClick={handleTogglePublic}
      disabled={isPending}
      className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] font-medium hover:bg-muted disabled:opacity-60"
      title={isPublic ? "Unpublish (hide from public)" : "Republish"}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isPublic ? (
        <EyeOff className="h-3 w-3" />
      ) : (
        <Eye className="h-3 w-3" />
      )}
      {isPublic ? "Unpublish" : "Republish"}
    </button>
  );
}
