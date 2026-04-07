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
import { signUpAction } from "@/lib/auth/actions";
import { ShoppingBag } from "lucide-react";

export default function SignupPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const role = "purchaser" as const;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);
    formData.set("role", role);

    const result = await signUpAction(formData);

    setLoading(false);

    if (result.error) {
      // Try i18n key first, fallback to raw message
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
          <CardTitle className="text-2xl">{t("signUp")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {/* Role selection hidden — only purchaser registration for now */}
            <input type="hidden" name="role" value="purchaser" />
            <div className="flex items-center gap-2 rounded-xl border-2 border-primary bg-primary/5 p-4">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{t("rolePurchaser")}</span>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : t("signUp")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t("alreadyHaveAccount")}{" "}
            <Link href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"} className="text-primary hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
