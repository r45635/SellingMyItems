"use client";

import { useTransition } from "react";
import { toggleProfileActiveAction } from "@/features/admin-dashboard/actions";

export function ToggleActiveButton({
  profileId,
  isActive,
}: {
  profileId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleProfileActiveAction(profileId);
        })
      }
      className={
        isActive
          ? "rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          : "rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-100 disabled:opacity-50"
      }
    >
      {isPending
        ? "..."
        : isActive
          ? "Disable"
          : "Enable"}
    </button>
  );
}
