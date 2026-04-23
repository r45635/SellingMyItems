"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createProjectAction, updateProjectAction } from "../actions";
import { useState } from "react";

interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormValues>;
  projectId?: string;
}

export function ProjectForm({ defaultValues, projectId }: ProjectFormProps) {
  const t = useTranslations();
  const tInv = useTranslations("invitations");
  const [serverError, setServerError] = useState("");
  const [visibility, setVisibility] = useState<"public" | "invitation_only">(
    defaultValues?.visibility ?? "public"
  );
  const isEdit = !!projectId;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      cityArea: "",
      description: "",
      ...defaultValues,
    },
  });

  async function onSubmit(data: ProjectFormValues) {
    setServerError("");
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    });
    if (!isEdit) {
      formData.set("visibility", visibility);
    }
    if (projectId) {
      formData.set("projectId", projectId);
      const result = await updateProjectAction(formData);
      if (result?.error && "form" in result.error && result.error.form?.[0]) {
        setServerError(result.error.form[0]);
      }
      return;
    }
    const result = await createProjectAction(formData);
    if (result?.error && "form" in result.error && result.error.form?.[0]) {
      setServerError(result.error.form[0]);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("seller.projectName")}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">{t("seller.projectSlug")}</Label>
            <Input
              id="slug"
              {...register("slug")}
              placeholder="my-project"
            />
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cityArea">{t("seller.projectCity")}</Label>
            <Input id="cityArea" {...register("cityArea")} />
            {errors.cityArea && (
              <p className="text-sm text-destructive">
                {errors.cityArea.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("item.description")}</Label>
            <Textarea id="description" {...register("description")} rows={3} />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>{tInv("visibilityLabel")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    visibility === "public"
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold">{tInv("visibilityPublic")}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {tInv("visibilityPublicHint")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("invitation_only")}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    visibility === "invitation_only"
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold">
                    {tInv("visibilityInvitation")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {tInv("visibilityInvitationHint")}
                  </div>
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("common.save")}
            </Button>
          </div>
          {serverError ? (
            <p className="text-sm text-destructive">{serverError}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
