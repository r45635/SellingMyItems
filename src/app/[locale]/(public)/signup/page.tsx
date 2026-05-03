"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SmiLogo } from "@/components/shared/smi-logo";
import { signUpAction } from "@/lib/auth/actions";
import { AuthSplitPanel } from "@/features/auth/components/auth-split-panel";

export default function SignupPage() {
  const t = useTranslations("auth");
  const tCookie = useTranslations("cookieNotice");
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorKey(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);

    const result = await signUpAction(formData);

    setLoading(false);

    if (result.error) {
      const msg = t.has(result.error) ? t(result.error) : result.error;
      setError(msg);
      setErrorKey(result.error);
      return;
    }

    const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/";
    window.location.href = dest;
  }

  // CTAs shown when an existing email blocks signup — pre-filled with the
  // email the user just typed.
  const emailQuery = email ? `?email=${encodeURIComponent(email)}` : "";
  const loginHref =
    returnTo && returnTo.startsWith("/")
      ? `/login?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(returnTo)}`
      : `/login${emailQuery}`;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid md:grid-cols-[44%_56%]">
      <AuthSplitPanel />

      <div className="flex items-center justify-center p-6 md:p-8 bg-white dark:bg-card">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex justify-center">
            <SmiLogo size="md" />
          </div>

          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{t("signUp")}</h1>
            <p className="text-sm text-muted-foreground">{t("signUpIntro")}</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {showPw ? t("hide") : t("show")}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                {errorKey === "emailTaken" && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link
                      href={loginHref}
                      className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {t("emailTakenSignInCta")}
                    </Link>
                    <Link
                      href={`/forgot-password${emailQuery}`}
                      className="inline-flex h-7 items-center rounded-md border border-border px-2.5 font-medium hover:bg-muted"
                    >
                      {t("emailTakenForgotCta")}
                    </Link>
                  </div>
                )}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("signingUp") : t("signUp")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("alreadyHaveAccount")}{" "}
              <Link
                href={
                  returnTo
                    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
                    : "/login"
                }
                className="text-primary hover:underline font-medium"
              >
                {t("signIn")}
              </Link>
            </p>

            <p className="text-center text-xs text-muted-foreground">
              {tCookie.rich("text", {
                privacy: (chunks) => (
                  <Link href="/privacy" className="underline hover:text-foreground">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
