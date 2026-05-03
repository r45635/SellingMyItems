"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SmiLogo } from "@/components/shared/smi-logo";
import { signInAction } from "@/lib/auth/actions";
import { AuthSplitPanel } from "@/features/auth/components/auth-split-panel";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCookie = useTranslations("cookieNotice");
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);

    const result = await signInAction(formData);

    setLoading(false);

    if (result.error) {
      const msg = t.has(result.error) ? t(result.error) : result.error;
      setError(msg);
      return;
    }

    // Full page reload so UserNav picks up the session cookie
    const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/";
    window.location.href = dest;
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid md:grid-cols-[44%_56%]">
      <AuthSplitPanel />

      <div className="flex items-center justify-center p-6 md:p-8 bg-white dark:bg-card">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile-only logo (the AuthSplitPanel is hidden < md) */}
          <div className="md:hidden flex justify-center">
            <SmiLogo size="md" />
          </div>

          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{t("signIn")}</h1>
            <p className="text-sm text-muted-foreground">{t("signInIntro")}</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
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
                  autoComplete="current-password"
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
              <div className="text-right">
                <Link
                  href={
                    email
                      ? `/forgot-password?email=${encodeURIComponent(email)}`
                      : "/forgot-password"
                  }
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("signingIn") : t("signIn")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link
                href={
                  returnTo
                    ? `/signup?returnTo=${encodeURIComponent(returnTo)}`
                    : "/signup"
                }
                className="text-primary hover:underline font-medium"
              >
                {t("signUp")}
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
