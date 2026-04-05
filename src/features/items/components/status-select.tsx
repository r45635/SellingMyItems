"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: string | null) {
    if (!newStatus || newStatus === currentStatus) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);
      formData.set("projectId", projectId);
      formData.set("status", newStatus);
      await updateItemStatusAction(formData);
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <Select onValueChange={handleChange} defaultValue={currentStatus}>
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
