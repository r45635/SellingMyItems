import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

function getProfileIdForUser(user: {
  id: string;
  isDemo?: boolean;
  role?: "guest" | "seller";
}) {
  if (!user.isDemo) return user.id;
  return user.role === "seller"
    ? DEMO_SELLER_PROFILE_ID
    : DEMO_GUEST_PROFILE_ID;
}

async function ensureProfile(profileId: string, email: string) {
  await db
    .insert(profiles)
    .values({ id: profileId, email, displayName: email.split("@")[0] })
    .onConflictDoNothing({ target: profiles.id });
}

async function updateProfileAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  const profileId = getProfileIdForUser(user);
  await ensureProfile(profileId, user.email);

  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  await db
    .update(profiles)
    .set({
      displayName: displayName || null,
      phone: phone || null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profileId));

  revalidatePath("/account");
}

export default async function AccountPage() {
  const t = await getTranslations("nav");
  const user = await requireUser();
  const profileId = getProfileIdForUser(user);
  await ensureProfile(profileId, user.email);

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  });

  return (
    <div className="container px-4 md:px-6 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("account")}</h1>

      <form action={updateProfileAction} className="space-y-4">
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
          Rôle : {user.role} {user.isDemo && "(demo)"}
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
