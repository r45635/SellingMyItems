import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

async function updateProfileAction(formData: FormData) {
  "use server";
  const user = await requireUser();

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

  revalidatePath("/account");
}

export default async function AccountPage() {
  const t = await getTranslations("nav");
  const user = await requireUser();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  return (
    <div className="container px-4 md:px-6 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("account")}</h1>

      <form action={updateProfileAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-1">
            Display name
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
            Phone
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          Role: {user.role === "seller" ? "Seller" : "Buyer"}
        </div>

        <Button type="submit" size="lg">
          Save
        </Button>
      </form>
    </div>
  );
}
