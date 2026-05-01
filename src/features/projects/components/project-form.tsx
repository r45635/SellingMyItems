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
  const [restrict, setRestrict] = useState<boolean>(
    Boolean(defaultValues?.radiusKm)
  );
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
      countryCode: undefined,
      postalCode: "",
      radiusKm: undefined,
      ...defaultValues,
    },
  });

  async function onSubmit(data: ProjectFormValues) {
    setServerError("");
    const formData = new FormData();
    // The "Restrict to my area" checkbox is local UI state — when off
    // we omit the radius entirely so the server treats it as cleared.
    const payload = {
      ...data,
      radiusKm: restrict ? data.radiusKm : undefined,
    };
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
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

          {/* Pickup location — drives buyer-side radius matching. The
              cityArea above is the human-readable label; country +
              postal code is what we geocode for distance queries. */}
          {isEdit && !defaultValues?.countryCode && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-semibold mb-1">
                {t("seller.locationMissingTitle")}
              </p>
              <p>{t("seller.locationMissingBody")}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="countryCode">{t("seller.projectCountry")}</Label>
              <select
                id="countryCode"
                {...register("countryCode")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="FR">France</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t("seller.projectPostal")}</Label>
              <Input
                id="postalCode"
                {...register("postalCode")}
                placeholder="75001"
                autoComplete="postal-code"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={restrict}
                onChange={(e) => setRestrict(e.target.checked)}
                className="rounded"
              />
              {t("seller.projectRestrict")}
            </label>
            {restrict && (
              <div className="flex items-center gap-2 pl-6">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  step={5}
                  placeholder="50"
                  {...register("radiusKm", {
                    setValueAs: (v: string) => {
                      if (v === "" || v === undefined || v === null)
                        return undefined;
                      const n = parseInt(v, 10);
                      return Number.isNaN(n) ? undefined : n;
                    },
                  })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  {t("seller.projectRestrictUnit")}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("seller.projectRestrictHint")}
            </p>
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
