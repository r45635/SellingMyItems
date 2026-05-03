"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createItemShareLinkAction } from "@/features/items/share-actions";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";

interface Props {
  itemId: string;
  itemTitle: string;
}

export function ShareItemDialog({ itemId, itemTitle }: Props) {
  const t = useTranslations("share");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && url === null) {
      // Generate on first open
      startTransition(async () => {
        const result = await createItemShareLinkAction(itemId);
        if ("error" in result) {
          setError(result.error);
        } else {
          setUrl(result.url);
          setExpiresAt(result.expiresAt);
        }
      });
    }
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5" />
        }
      >
        <Share2 className="h-4 w-4" />
        <span>{t("shareItem")}</span>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shareItemTitle")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">{t("shareItemDesc")}</p>

        {isPending && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("generating")}</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {url && !isPending && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={url}
                readOnly
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={t("copyLink")}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 font-medium">{t("linkCopied")}</p>
            )}
            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                {t("linkExpiry")} —{" "}
                <LocalizedDateTime value={expiresAt} />
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
