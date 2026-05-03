"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportDataForm() {
  const t = useTranslations("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateLimitMsg, setRateLimitMsg] = useState("");

  async function handleExport() {
    setError("");
    setRateLimitMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/account/export");

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const hours = data.retryAfterSeconds
          ? Math.ceil(data.retryAfterSeconds / 3600)
          : 24;
        setRateLimitMsg(t("exportDataRateLimit", { hours }));
        return;
      }

      if (!res.ok) {
        setError(t("exportDataError"));
        return;
      }

      // Trigger download via a temporary <a> element.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `my-data-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("exportDataError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <fieldset className="rounded-xl border p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold">
        {t("exportData")}
      </legend>

      <p className="text-sm text-muted-foreground">{t("exportDataDesc")}</p>

      {rateLimitMsg ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {rateLimitMsg}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-3.5 w-3.5" />
        )}
        {loading ? t("exportDataLoading") : t("exportDataButton")}
      </Button>
    </fieldset>
  );
}
