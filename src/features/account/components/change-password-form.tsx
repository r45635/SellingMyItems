"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePasswordAction } from "@/lib/auth/actions";

const ERROR_KEYS = new Set([
  "passwordTooShort",
  "passwordMismatch",
  "passwordSameAsOld",
  "wrongCurrentPassword",
  "tooManyRequests",
  "notSignedIn",
]);

export function ChangePasswordForm() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (result?.error) {
        const key = ERROR_KEYS.has(result.error) ? result.error : "passwordChangeFailed";
        toast.error(tAuth(key as never));
        return;
      }
      toast.success(t("passwordChanged"));
      formRef.current?.reset();
      setOpen(false);
    });
  }

  return (
    <fieldset className="rounded-xl border p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold">
        {t("changePassword")}
      </legend>

      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("changePasswordDesc")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            {t("changePassword")}
          </Button>
        </div>
      ) : (
        <form ref={formRef} action={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-xs font-medium mb-1"
            >
              {t("currentPassword")}
            </label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-xs font-medium mb-1"
              >
                {t("newPassword")}
              </label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                disabled={isPending}
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium mb-1"
              >
                {t("confirmPassword")}
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                disabled={isPending}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              name="signOutOtherDevices"
              defaultChecked
              className="rounded border-gray-300"
            />
            {t("signOutOtherDevices")}
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("changePassword")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                formRef.current?.reset();
              }}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </fieldset>
  );
}
