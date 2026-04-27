"use server";

import { requireAdmin, requireSeller } from "@/lib/auth";
import { projectFormSchema } from "@/lib/validations";
import { db } from "@/db";
import { projects, sellerAccounts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { findSellerProject } from "@/lib/seller-accounts";

async function getSellerAccount(userId: string) {
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, userId),
  });
  return sellerAccount ?? null;
}

/**
 * Lazy-mint a sellerAccounts row for the user if they don't have one yet.
 * Lets any signed-in user create their first project without a separate
 * "become a seller" UI — the act of creating a project IS the activation.
 */
async function ensureSellerAccount(userId: string) {
  const existing = await getSellerAccount(userId);
  if (existing) return existing;
  const [created] = await db
    .insert(sellerAccounts)
    .values({ userId, isActive: true })
    .returning();
  return created;
}

export async function createProjectAction(formData: FormData) {
  const user = await requireSeller();

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    cityArea: formData.get("cityArea"),
    description: formData.get("description") || undefined,
    visibility: formData.get("visibility") || undefined,
  };

  const validated = projectFormSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const sellerAccount = await ensureSellerAccount(user.id);
  if (!sellerAccount) {
    return { error: { form: ["Could not initialize selling account"] } };
  }

  try {
    // New projects start in `draft`. The user has to explicitly submit them
    // for review (submitProjectForReviewAction) before an admin can approve
    // and make them publicly visible.
    await db.insert(projects).values({
      sellerId: sellerAccount.id,
      name: validated.data.name,
      slug: validated.data.slug,
      cityArea: validated.data.cityArea,
      description: validated.data.description,
      visibility: validated.data.visibility ?? "public",
      publishStatus: "draft",
      isPublic: false,
    });
  } catch {
    return { error: { form: ["Unable to create project (slug already in use?)"] } };
  }

  redirect("/seller/projects");
}

export async function updateProjectAction(formData: FormData) {
  const user = await requireSeller();
  const projectIdOrSlug = formData.get("projectId") as string;

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    cityArea: formData.get("cityArea"),
    description: formData.get("description") || undefined,
    // Note: visibility edits go through setProjectVisibilityAction (triggers reset)
  };

  const validated = projectFormSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const sellerAccount = await getSellerAccount(user.id);
  if (!sellerAccount) {
    return { error: { form: ["Seller account not found"] } };
  }

  const ownedProject = await findSellerProject(sellerAccount.id, projectIdOrSlug);
  if (!ownedProject) {
    return { error: { form: ["Project not found or unauthorized"] } };
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
      .where(eq(projects.id, ownedProject.id));
  } catch {
    return { error: { form: ["Unable to update project"] } };
  }

  redirect("/seller/projects");
}

export async function deleteProjectAction(projectIdOrSlug: string) {
  const user = await requireSeller();

  const sellerAccount = await getSellerAccount(user.id);
  if (!sellerAccount) return;

  const ownedProject = await findSellerProject(sellerAccount.id, projectIdOrSlug);
  if (!ownedProject) return;

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, ownedProject.id));

  redirect("/seller/projects");
}

// ─── Publication workflow ──────────────────────────────────────────────────

/**
 * Owner submits a draft (or rejected) project for admin review. Moves the
 * project into `pending` status and stamps `submittedAt`. Idempotent for
 * already-pending or already-approved projects (no-op).
 */
export async function submitProjectForReviewAction(projectIdOrSlug: string) {
  const user = await requireSeller();

  const sellerAccount = await getSellerAccount(user.id);
  if (!sellerAccount) return { error: "Seller account not found" };

  const ownedProject = await findSellerProject(
    sellerAccount.id,
    projectIdOrSlug
  );
  if (!ownedProject) return { error: "Project not found" };

  // Already approved or pending → nothing to do.
  if (
    ownedProject.publishStatus === "approved" ||
    ownedProject.publishStatus === "pending"
  ) {
    return { success: true, status: ownedProject.publishStatus };
  }

  await db
    .update(projects)
    .set({
      publishStatus: "pending",
      submittedAt: new Date(),
      reviewerNote: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, ownedProject.id));

  revalidatePath(`/seller/projects`);
  revalidatePath(`/seller/projects/${projectIdOrSlug}/items`);
  revalidatePath(`/admin/projects`);
  return { success: true, status: "pending" as const };
}

/**
 * Admin approves a pending project — flips it to `approved` and makes it
 * publicly visible (`is_public = true`).
 */
export async function approveProjectAction(projectId: string) {
  await requireAdmin();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!project) return { error: "Project not found" };

  await db
    .update(projects)
    .set({
      publishStatus: "approved",
      reviewedAt: new Date(),
      reviewerNote: null,
      isPublic: true,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  revalidatePath("/admin/projects");
  revalidatePath("/");
  revalidatePath(`/project/${project.slug}`);
  return { success: true };
}

/**
 * Admin rejects a pending project. Sets status `rejected`, optionally
 * stores a reviewer note (visible to the owner), and pulls it from the
 * public listing if it was somehow published.
 */
export async function rejectProjectAction(projectId: string, note?: string) {
  await requireAdmin();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!project) return { error: "Project not found" };

  await db
    .update(projects)
    .set({
      publishStatus: "rejected",
      reviewedAt: new Date(),
      reviewerNote: note?.trim() ? note.trim().slice(0, 500) : null,
      isPublic: false,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  revalidatePath("/admin/projects");
  revalidatePath("/");
  revalidatePath(`/project/${project.slug}`);
  return { success: true };
}
