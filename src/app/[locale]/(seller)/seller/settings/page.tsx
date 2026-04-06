import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { profiles, sellerAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function updateSellerProfileAction(formData: FormData) {
  "use server";
  const user = await requireSeller();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  await db
    .update(profiles)
    .set({
      displayName: displayName || null,
      phone: phone || null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/seller/settings");
}

export default async function SellerSettingsPage() {
  const t = await getTranslations("seller");
  const user = await requireSeller();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("settings")}</h1>

      <form action={updateSellerProfileAction} className="space-y-4 max-w-lg">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-1">
            Nom d&apos;affichage
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={profile?.displayName ?? ""}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            Téléphone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          Compte vendeur : {sellerAccount ? "Actif" : "Non créé"}
          {sellerAccount?.createdAt &&
            ` • Depuis le ${new Date(sellerAccount.createdAt).toLocaleDateString()}`}
        </div>

        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Enregistrer
        </button>
      </form>
    </div>
  );
}
