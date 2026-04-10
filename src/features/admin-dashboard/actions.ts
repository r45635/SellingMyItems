"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { profiles, projects, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { invalidateResendApiKeyCache } from "@/lib/email";

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

export async function updateResendApiKeyAction(formData: FormData) {
  const user = await requireAdmin();
  const newKey = String(formData.get("apiKey") ?? "").trim();

  if (!newKey) {
    return { error: "API key is required" };
  }

  if (!newKey.startsWith("re_")) {
    return { error: "Invalid Resend API key format (should start with re_)" };
  }

  // Upsert into app_settings
  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, "resend_api_key"),
  });

  if (existing) {
    await db
      .update(appSettings)
      .set({ value: newKey, updatedAt: new Date(), updatedBy: user.id })
      .where(eq(appSettings.key, "resend_api_key"));
  } else {
    await db.insert(appSettings).values({
      key: "resend_api_key",
      value: newKey,
      updatedBy: user.id,
    });
  }

  // Invalidate the cached key so it's picked up on next email send
  invalidateResendApiKeyCache();

  revalidatePath("/admin/emails");
  return { success: true };
}
