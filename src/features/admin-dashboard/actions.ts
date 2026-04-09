"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { profiles, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function toggleProfileActiveAction(profileId: string) {
  await requireAdmin();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: { id: true, isActive: true, role: true },
  });

  if (!profile || profile.role === "admin") {
    return { error: "Profile not found or not editable" };
  }

  await db
    .update(profiles)
    .set({ isActive: !profile.isActive, updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function toggleProjectPublicAction(projectId: string) {
  await requireAdmin();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, isPublic: true },
  });

  if (!project) {
    return { error: "Project not found" };
  }

  await db
    .update(projects)
    .set({ isPublic: !project.isPublic, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  revalidatePath("/admin/projects");
  return { success: true };
}
