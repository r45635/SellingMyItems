"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { deleteAccountAction } from "@/features/account/actions";

export function DeleteAccountForm() {
  const t = useTranslations("account");
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await deleteAccountAction(formData);
      if (result?.error) {
        if (result.error === "invalidPassword") {
          setError(t("errorInvalidPassword"));
        } else if (result.error === "passwordRequired") {
          setError(t("errorPasswordRequired"));
        } else {
          setError(result.error);
        }
      }
      // On success the action redirects — nothing more to do here.
    });
  }

  return (
    <fieldset className="rounded-xl border border-destructive/30 p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold text-destructive">
        {t("deleteAccount")}
      </legend>

      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("deleteAccountDesc")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive/50 text-destructive hover:bg-destructive/5"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t("deleteAccount")}
          </Button>
        </div>
      ) : (
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              {t("deleteAccountWarning")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-account-password">
              {t("deleteAccountConfirm")}
            </Label>
            <Input
              id="delete-account-password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("deleteAccountButton")}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setError("");
                formRef.current?.reset();
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </fieldset>
  );
}
