"use server";

import { requireSeller } from "@/lib/auth";
import { projectFormSchema } from "@/lib/validations";
import { db } from "@/db";
import { projects, sellerAccounts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

async function getSellerAccount(userId: string) {
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, userId),
  });
  return sellerAccount ?? null;
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

  const sellerAccount = await getSellerAccount(user.id);
  if (!sellerAccount) {
    return { error: { form: ["Compte vendeur introuvable"] } };
  }

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

  const sellerAccount = await getSellerAccount(user.id);
  if (!sellerAccount) {
    return { error: { form: ["Compte vendeur introuvable"] } };
  }

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

  const sellerAccount = await getSellerAccount(user.id);
  if (!sellerAccount) return;

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
