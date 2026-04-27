"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SmiLogo } from "@/components/shared/smi-logo";
import { signInAction } from "@/lib/auth/actions";

export default function LoginPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
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
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <SmiLogo size="md" />
          </div>
          <CardTitle className="text-2xl">{t("signIn")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
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
              {loading ? "..." : t("signIn")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link
                href={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"}
                className="text-primary hover:underline"
              >
                {t("signUp")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
