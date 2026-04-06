"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { SmiLogo } from "@/components/shared/smi-logo";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"real" | "demo">("real");

  async function handleRealSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const supabase = createClient();
    if (!supabase) {
      setError(t("authNotConfigured"));
      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleDemoSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Identifiants invalides. Utilise guest/guest ou seller/seller.");
      return;
    }

    if (email === "seller") {
      router.push("/seller");
    } else {
      router.push("/");
    }
    router.refresh();
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
          {mode === "real" ? (
            <form onSubmit={handleRealSignIn} className="space-y-4">
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
                  href="/signup"
                  className="text-primary hover:underline"
                >
                  {t("signUp")}
                </Link>
              </p>
            </form>
          ) : (
            <>
              <div className="rounded-xl border bg-muted/40 p-4 text-sm space-y-2">
                <p className="font-medium text-center">Demo</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEmail("guest");
                      setPassword("guest");
                    }}
                  >
                    🛒 Guest
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEmail("seller");
                      setPassword("seller");
                    }}
                  >
                    🏷️ Seller
                  </Button>
                </div>
              </div>
              <form onSubmit={handleDemoSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-username">Login</Label>
                  <Input
                    id="demo-username"
                    type="text"
                    placeholder="guest ou seller"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-password">Mot de passe</Label>
                  <Input
                    id="demo-password"
                    type="password"
                    placeholder="identique au login"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : t("signIn")}
                </Button>
              </form>
            </>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {mode === "real" ? "Demo" : t("signIn")}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => {
              setMode(mode === "real" ? "demo" : "real");
              setEmail("");
              setPassword("");
              setError("");
            }}
          >
            {mode === "real" ? t("switchToDemo") : t("switchToReal")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
