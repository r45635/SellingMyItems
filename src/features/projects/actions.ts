"use server";

import { requireSeller } from "@/lib/auth";
import { projectFormSchema } from "@/lib/validations";
import { db } from "@/db";
import { profiles, projects, sellerAccounts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

function getProfileIdForUser(user: { id: string; isDemo?: boolean; role?: "guest" | "seller" }) {
  if (!user.isDemo) {
    return user.id;
  }
  return user.role === "seller" ? DEMO_SELLER_PROFILE_ID : DEMO_GUEST_PROFILE_ID;
}

async function ensureSellerAccount(profileId: string, email: string) {
  await db
    .insert(profiles)
    .values({
      id: profileId,
      email,
      displayName: email.split("@")[0],
    })
    .onConflictDoNothing({ target: profiles.id });

  const existingSeller = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
  });

  if (existingSeller) {
    return existingSeller;
  }

  const [createdSeller] = await db
    .insert(sellerAccounts)
    .values({
      userId: profileId,
      isActive: true,
    })
    .returning();

  return createdSeller;
}

export async function createProjectAction(formData: FormData) {
  const user = await requireSeller();

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    cityArea: formData.get("cityArea"),
    description: formData.get("description") || undefined,
  };

  const validated = projectFormSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const profileId = getProfileIdForUser(user);
  const sellerAccount = await ensureSellerAccount(profileId, user.email);

  try {
    await db.insert(projects).values({
      sellerId: sellerAccount.id,
      name: validated.data.name,
      slug: validated.data.slug,
      cityArea: validated.data.cityArea,
      description: validated.data.description,
    });
  } catch {
    return { error: { form: ["Impossible de créer le projet (slug déjà utilisé ?)"] } };
  }

  redirect("/seller/projects");
}

export async function updateProjectAction(formData: FormData) {
  const user = await requireSeller();
  const projectId = formData.get("projectId") as string;

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    cityArea: formData.get("cityArea"),
    description: formData.get("description") || undefined,
  };

  const validated = projectFormSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const profileId = getProfileIdForUser(user);
  const sellerAccount = await ensureSellerAccount(profileId, user.email);

  try {
    await db
      .update(projects)
      .set({
        name: validated.data.name,
        slug: validated.data.slug,
        cityArea: validated.data.cityArea,
        description: validated.data.description,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.sellerId, sellerAccount.id),
          isNull(projects.deletedAt)
        )
      );
  } catch {
    return { error: { form: ["Impossible de mettre à jour le projet"] } };
  }

  redirect("/seller/projects");
}

export async function deleteProjectAction(projectId: string) {
  const user = await requireSeller();

  const profileId = getProfileIdForUser(user);
  const sellerAccount = await ensureSellerAccount(profileId, user.email);

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.sellerId, sellerAccount.id),
        isNull(projects.deletedAt)
      )
    );

  redirect("/seller/projects");
}
