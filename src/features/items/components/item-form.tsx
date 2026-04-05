"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { itemFormSchema, type ItemFormValues } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createItemAction, updateItemAction } from "../actions";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ImageUpload } from "@/components/shared/image-upload";

interface ItemFormProps {
  projectId: string;
  defaultValues?: Partial<ItemFormValues>;
  itemId?: string;
  categories?: { id: string; name: string }[];
  existingImages?: { url: string; altText?: string | null }[];
  existingLinks?: { url: string; label?: string | null }[];
}

export function ItemForm({
  projectId,
  defaultValues,
  itemId,
  categories = [],
  existingImages = [],
  existingLinks = [],
}: ItemFormProps) {
  const t = useTranslations();
  const [serverError, setServerError] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>(
    existingImages.map((img) => img.url)
  );
  const [links, setLinks] = useState<{ url: string; label: string }[]>(
    existingLinks.map((l) => ({ url: l.url, label: l.label ?? "" }))
  );
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      title: "",
      brand: "",
      description: "",
      condition: "",
      approximateAge: "",
      price: undefined,
      originalPrice: undefined,
      currency: "USD",
      notes: "",
      status: "available",
      ...defaultValues,
    },
  });

  async function onSubmit(data: ItemFormValues) {
    setServerError("");
    const formData = new FormData();
    formData.set("projectId", projectId);
    if (itemId) {
      formData.set("itemId", itemId);
    }
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    });
    // Append image URLs
    imageUrls.forEach((url) => formData.append("imageUrl", url));

    // Auto-add pending link input before submitting
    const allLinks = [...links];
    if (newLinkUrl.trim()) {
      allLinks.push({ url: newLinkUrl.trim(), label: newLinkLabel.trim() });
    }

    // Append links as JSON
    allLinks.forEach((link) =>
      formData.append("link", JSON.stringify(link))
    );

    if (itemId) {
      const result = await updateItemAction(formData);
      if (result?.error && "form" in result.error && result.error.form?.[0]) {
        setServerError(result.error.form[0]);
      }
      return;
    }

    const result = await createItemAction(formData);
    if (result?.error && "form" in result.error && result.error.form?.[0]) {
      setServerError(result.error.form[0]);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("item.title")}</Label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">{t("item.brand")}</Label>
              <Input id="brand" {...register("brand")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">{t("item.condition")}</Label>
              <Input id="condition" {...register("condition")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">{t("item.price")}</Label>
              <Input
                id="price"
                type="number"
                {...register("price", {
                  setValueAs: (v: string) => {
                    if (v === "" || v === undefined || v === null) return undefined;
                    const n = parseInt(v, 10);
                    return Number.isNaN(n) ? undefined : n;
                  },
                })}
                placeholder="25"
              />
              {errors.price && (
                <p className="text-sm text-destructive">
                  {errors.price.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="originalPrice">{t("item.originalPrice")}</Label>
              <Input
                id="originalPrice"
                type="number"
                {...register("originalPrice", {
                  setValueAs: (v: string) => {
                    if (v === "" || v === undefined || v === null) return undefined;
                    const n = parseInt(v, 10);
                    return Number.isNaN(n) ? undefined : n;
                  },
                })}
                placeholder="50"
              />
              {errors.originalPrice && (
                <p className="text-sm text-destructive">
                  {errors.originalPrice.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("item.currency")}</Label>
              <Select
                onValueChange={(value) =>
                  setValue("currency", value as "USD" | "EUR" | "CAD")
                }
                defaultValue={watch("currency")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approximateAge">{t("item.age")}</Label>
              <Input id="approximateAge" {...register("approximateAge")} />
            </div>
          </div>

          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>{t("item.category")}</Label>
              <Select
                onValueChange={(value) => setValue("categoryId", value ?? undefined)}
                defaultValue={defaultValues?.categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t("item.description")}</Label>
            <Textarea
              id="description"
              {...register("description")}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("item.notes")}</Label>
            <Textarea id="notes" {...register("notes")} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>{t("item.status")}</Label>
            <Select
              onValueChange={(value) =>
                setValue("status", value as "available" | "pending" | "sold")
              }
              defaultValue={watch("status")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">
                  {t("item.available")}
                </SelectItem>
                <SelectItem value="pending">{t("item.pending")}</SelectItem>
                <SelectItem value="sold">{t("item.sold")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Image upload section */}
          <div className="space-y-2">
            <Label>{t("item.images")}</Label>
            <ImageUpload
              images={imageUrls}
              onChange={setImageUrls}
              maxImages={10}
            />
          </div>

          {/* External links section */}
          <div className="space-y-2">
            <Label>{t("item.links")}</Label>
            {links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={link.url}
                  onChange={(e) =>
                    setLinks((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, url: e.target.value } : l
                      )
                    )
                  }
                  placeholder="https://example.com/ref"
                  className="flex-1"
                />
                <Input
                  value={link.label}
                  onChange={(e) =>
                    setLinks((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, label: e.target.value } : l
                      )
                    )
                  }
                  placeholder="Label"
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setLinks((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/ref"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Label"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="w-32"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (newLinkUrl.trim()) {
                    setLinks((prev) => [
                      ...prev,
                      { url: newLinkUrl.trim(), label: newLinkLabel.trim() },
                    ]);
                    setNewLinkUrl("");
                    setNewLinkLabel("");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
