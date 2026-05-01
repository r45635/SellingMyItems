"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ITEM_STATUSES } from "@/lib/validations";
import { updateItemStatusAction } from "../actions";
import { Loader2 } from "lucide-react";

interface StatusSelectProps {
  itemId: string;
  projectId: string;
  currentStatus: string;
}

export function StatusSelect({ itemId, projectId, currentStatus }: StatusSelectProps) {
  const t = useTranslations("seller");

  // Optimistic UI: update the trigger immediately on click and let the
  // server action revalidate in the background. Roll back on error.
  const [optimistic, setOptimistic] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  // Resync from props if the server data changes for any reason
  // (another tab, an admin override, etc.).
  useEffect(() => {
    setOptimistic(currentStatus);
  }, [currentStatus]);

  function handleChange(newStatus: string | null) {
    if (!newStatus || newStatus === optimistic || isPending) return;

    const previous = optimistic;
    setOptimistic(newStatus);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);
      formData.set("projectId", projectId);
      formData.set("status", newStatus);

      const result = await updateItemStatusAction(formData);

      if (result && "error" in result && result.error) {
        // Revert UI and surface the error. The server's revalidatePath
        // will not have fired so the rest of the page stays consistent.
        setOptimistic(previous);
        toast.error(result.error);
      }
      // On success: no toast — the visible state change is feedback enough
      // and we want to avoid noise on rapid status edits. The server has
      // already revalidated so the rest of the row reflects side effects
      // (sold buyer link, reservation cleared, etc.).
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <Select onValueChange={handleChange} value={optimistic} disabled={isPending}>
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ITEM_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {t(`status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
