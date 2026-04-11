"use client";

import { useState, useTransition } from "react";
import { submitIntentAction } from "@/features/intents/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Ban, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface IntentItem {
  itemId: string;
  itemTitle: string;
  itemStatus: string;
}

interface IntentSubmitDialogProps {
  projectId: string;
  items: IntentItem[];
  labels: {
    sendIntent: string;
    phone: string;
    optional: string;
    pickupNotes: string;
    submit: string;
    submitted: string;
    unavailableItemsWarning: string;
    noAvailableItems: string;
  };
}

export function IntentSubmitDialog({
  projectId,
  items,
  labels,
}: IntentSubmitDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const availableItems = items.filter((i) => i.itemStatus === "available");
  const unavailableItems = items.filter((i) => i.itemStatus !== "available");
  const hasAvailable = availableItems.length > 0;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitIntentAction(formData);
      toast.success(labels.submitted);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default" size="lg" className="w-full">
            <ShoppingCart className="h-4 w-4 mr-2" />
            {labels.sendIntent}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.sendIntent}</DialogTitle>
        </DialogHeader>

        {unavailableItems.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {labels.unavailableItemsWarning}
            </p>
          </div>
        )}

        {!hasAvailable ? (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 flex items-start gap-2">
            <Ban className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 dark:text-red-200 font-medium">
              {labels.noAvailableItems}
            </p>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-3">
            {availableItems.map((item) => (
              <input key={item.itemId} type="hidden" name="itemId" value={item.itemId} />
            ))}

            <div>
              <label htmlFor={`phone-${projectId}`} className="block text-sm font-medium mb-1">
                {labels.phone}{" "}
                <span className="text-muted-foreground font-normal">({labels.optional})</span>
              </label>
              <Input id={`phone-${projectId}`} name="phone" type="tel" />
            </div>

            <div>
              <label htmlFor={`notes-${projectId}`} className="block text-sm font-medium mb-1">
                {labels.pickupNotes}
              </label>
              <Textarea id={`notes-${projectId}`} name="pickupNotes" rows={2} />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending ? "..." : labels.submit}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
