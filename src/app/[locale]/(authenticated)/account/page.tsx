import { getTranslations } from "next-intl/server";
import { requireUser, getUserCapabilities } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Mail, ShoppingCart, Tag, Shield } from "lucide-react";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";

async function updateProfileAction(formData: FormData) {
  "use server";
  const user = await requireUser();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const emailVisibilityRaw = String(formData.get("emailVisibility") ?? "hidden");
  const emailVisibility: "hidden" | "direct" =
    emailVisibilityRaw === "direct" ? "direct" : "hidden";

  await db
    .update(profiles)
    .set({
      displayName: displayName || null,
      phone: phone || null,
      emailVisibility,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/account");
}

export default async function AccountPage() {
  const t = await getTranslations("nav");
  const tAccount = await getTranslations("account");
  const tContext = await getTranslations("context");
  const user = await requireUser();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });
  const currentVisibility = profile?.emailVisibility ?? "hidden";
  const capabilities = await getUserCapabilities(user);

  return (
    <div className="container px-4 md:px-6 py-8 max-w-2xl">
      <h1 className="text-heading-2 mb-6">{t("account")}</h1>

      <form action={updateProfileAction} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <Input id="email" type="email" value={user.email} disabled />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-1">
            {tAccount("displayName")}
          </label>
          <Input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={profile?.displayName ?? ""}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            {tAccount("phone")}
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
          />
        </div>

        <fieldset className="rounded-xl border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold">
            {tAccount("emailVisibility")}
          </legend>
          <p className="text-sm text-muted-foreground">
            {tAccount("emailVisibilityDesc")}
          </p>

          <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50 transition-colors has-[:checked]:border-orange-300 has-[:checked]:bg-orange-50/50 dark:has-[:checked]:bg-orange-950/20">
            <input
              type="radio"
              name="emailVisibility"
              value="hidden"
              defaultChecked={currentVisibility === "hidden"}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Lock className="h-3.5 w-3.5" />
                {tAccount("visibilityHidden")}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tAccount("visibilityHiddenDesc")}
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50 transition-colors has-[:checked]:border-orange-300 has-[:checked]:bg-orange-50/50 dark:has-[:checked]:bg-orange-950/20">
            <input
              type="radio"
              name="emailVisibility"
              value="direct"
              defaultChecked={currentVisibility === "direct"}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Mail className="h-3.5 w-3.5" />
                {tAccount("visibilityDirect")}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tAccount("visibilityDirectDesc")}
              </p>
            </div>
          </label>
        </fieldset>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold mb-2">{tAccount("capabilities")}</p>
          <p className="text-xs text-muted-foreground mb-3">
            {tAccount("capabilitiesDesc")}
          </p>
          <ul className="flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50">
              <ShoppingCart className="h-3 w-3" />
              {tContext("buyer")}
            </li>
            {capabilities.seller && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900/50">
                <Tag className="h-3 w-3" />
                {tContext("seller")}
              </li>
            )}
            {capabilities.admin && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/50">
                <Shield className="h-3 w-3" />
                {tContext("admin")}
              </li>
            )}
          </ul>
        </div>

        <Button type="submit" size="lg">
          {tAccount("save")}
        </Button>
      </form>

      <div className="mt-8">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
