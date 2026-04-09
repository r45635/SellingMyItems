"use client";

import { useTransition } from "react";
import { toggleProjectPublicAction } from "@/features/admin-dashboard/actions";

export function TogglePublicButton({
  projectId,
  isPublic,
}: {
  projectId: string;
  isPublic: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleProjectPublicAction(projectId);
        })
      }
      className={
        isPublic
          ? "rounded-md bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-600 hover:bg-yellow-100 disabled:opacity-50"
          : "rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-100 disabled:opacity-50"
      }
    >
      {isPending
        ? "..."
        : isPublic
          ? "Hide"
          : "Publish"}
    </button>
  );
}
