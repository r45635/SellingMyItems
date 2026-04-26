"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckSquare, Square, Download, Mail, Loader2, X } from "lucide-react";
import { emailProjectRecapPdfAction } from "@/features/seller-dashboard/pdf-actions";

export type SelectableItem = {
  id: string;
  title: string;
  status: "available" | "pending" | "reserved" | "sold" | "hidden";
};

interface Props {
  projectIdOrSlug: string;
  items: SelectableItem[];
  locale: string;
}

export function ItemsExportControls({
  projectIdOrSlug,
  items,
  locale,
}: Props) {
  const t = useTranslations("seller");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [isSending, startSending] = useTransition();

  // Sync the visual state of every row checkbox with our local Set. We use
  // DOM checkboxes (rendered in the server-side row markup) so the page can
  // stay primarily server-rendered — this hook keeps them in lockstep.
  useEffect(() => {
    const handler = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.dataset.selectorRow !== "1") return;
      const id = target.value;
      setSelected((prev) => {
        const next = new Set(prev);
        if (target.checked) next.add(id);
        else next.delete(id);
        return next;
      });
    };
    document.addEventListener("change", handler);
    return () => document.removeEventListener("change", handler);
  }, []);

  // When `selected` changes via toolbar buttons (select all / reserved /
  // none), reflect the change in the rendered DOM checkboxes.
  useEffect(() => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[data-selector-row="1"]'
    );
    checkboxes.forEach((cb) => {
      cb.checked = selected.has(cb.value);
    });
  }, [selected]);

  const reservedIds = useMemo(
    () => items.filter((i) => i.status === "reserved").map((i) => i.id),
    [items]
  );

  function selectAll() {
    setSelected(new Set(items.map((i) => i.id)));
  }
  function selectReserved() {
    setSelected(new Set(reservedIds));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  const downloadHref = useMemo(() => {
    if (selected.size === 0) return null;
    const ids = Array.from(selected).join(",");
    return `/api/seller/projects/${projectIdOrSlug}/recap.pdf?items=${encodeURIComponent(
      ids
    )}&locale=${locale}`;
  }, [selected, projectIdOrSlug, locale]);

  function handleEmail() {
    if (!emailRecipient || selected.size === 0) return;
    startSending(async () => {
      const result = await emailProjectRecapPdfAction({
        projectIdOrSlug,
        recipientEmail: emailRecipient,
        itemIds: Array.from(selected),
        message: emailMessage,
        locale,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("pdfEmailSent"));
      setEmailDialogOpen(false);
      setEmailRecipient("");
      setEmailMessage("");
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card mb-4">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <span className="text-sm font-medium tabular-nums">
          {t("pdfSelectedCount", { count: selected.size })}
        </span>
        <button
          type="button"
          onClick={selectAll}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs hover:bg-muted"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {t("pdfSelectAll")}
        </button>
        <button
          type="button"
          onClick={selectReserved}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs hover:bg-muted"
          disabled={reservedIds.length === 0}
        >
          {t("pdfSelectReserved")} ({reservedIds.length})
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs hover:bg-muted"
          >
            <Square className="h-3.5 w-3.5" />
            {t("pdfSelectNone")}
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {downloadHref ? (
            <a
              href={downloadHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" />
              {t("pdfDownload")}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-semibold text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              {t("pdfDownload")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEmailDialogOpen(true)}
            disabled={selected.size === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail className="h-3.5 w-3.5" />
            {t("pdfEmail")}
          </button>
        </div>
      </div>

      {emailDialogOpen && (
        <div className="border-t bg-muted/30 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">
              {t("pdfEmailTitle", { count: selected.size })}
            </p>
            <button
              type="button"
              onClick={() => setEmailDialogOpen(false)}
              aria-label={t("cancelAction")}
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="email"
            placeholder={t("pdfEmailRecipient")}
            value={emailRecipient}
            onChange={(e) => setEmailRecipient(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            required
          />
          <textarea
            placeholder={t("pdfEmailMessage")}
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEmailDialogOpen(false)}
              className="inline-flex h-7 items-center rounded-md border px-2.5 text-xs hover:bg-muted"
            >
              {t("cancelAction")}
            </button>
            <button
              type="button"
              onClick={handleEmail}
              disabled={isSending || !emailRecipient}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              {t("pdfEmailSend")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
