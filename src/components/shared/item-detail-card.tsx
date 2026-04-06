import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock } from "lucide-react";
import { ImageCarousel } from "./image-carousel";
import { useTranslations } from "next-intl";
import { ITEM_CONDITIONS } from "@/lib/validations";

interface ItemDetailCardProps {
  title: string;
  coverImageUrl?: string | null;
  images?: { url: string; alt?: string }[];
  links?: { url: string; label?: string }[];
  price?: number | null;
  originalPrice?: number | null;
  currency?: string;
  brand?: string | null;
  description?: string | null;
  condition?: string | null;
  approximateAge?: string | null;
  notes?: string | null;
  status?: "available" | "pending" | "reserved" | "sold" | "hidden";
  categoryName?: string | null;
  updatedAt?: Date | string | null;
}

export function ItemDetailCard({
  title,
  coverImageUrl,
  images = [],
  links = [],
  price,
  originalPrice,
  currency = "USD",
  brand,
  description,
  condition,
  approximateAge,
  notes,
  status = "available",
  categoryName,
  updatedAt,
}: ItemDetailCardProps) {
  const t = useTranslations("item");

  const formattedPrice =
    price != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(price)
      : null;

  const formattedOriginalPrice =
    originalPrice != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(originalPrice)
      : null;

  // Build the full list of images: itemImages first, then cover as fallback
  const allImages =
    images.length > 0
      ? images
      : coverImageUrl
        ? [{ url: coverImageUrl, alt: title }]
        : [];

  const statusLabel = t(status);

  // Translate condition if it's a known value, else show raw string
  const isKnownCondition = condition && (ITEM_CONDITIONS as readonly string[]).includes(condition);
  const conditionLabel = isKnownCondition ? t(`conditions.${condition}`) : condition;

  const formattedDate = updatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
        typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt
      )
    : null;

  return (
    <Card className="overflow-hidden">
      <ImageCarousel images={allImages} title={title} />

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant={status === "sold" ? "destructive" : status === "pending" || status === "reserved" ? "secondary" : status === "hidden" ? "outline" : "default"}>
            {statusLabel}
          </Badge>
        </div>
        {(formattedPrice || formattedOriginalPrice) && (
          <div className="flex items-baseline gap-2">
            {formattedPrice && (
              <p className="text-2xl font-bold text-primary">{formattedPrice}</p>
            )}
            {formattedOriginalPrice && (
              <p className="text-lg text-muted-foreground line-through">{formattedOriginalPrice}</p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {categoryName && (
          <div>
            <span className="text-sm text-muted-foreground">{t("category")}: </span>
            <Badge variant="outline">{categoryName}</Badge>
          </div>
        )}
        {brand && (
          <div>
            <span className="text-sm text-muted-foreground">{t("brand")}: </span>
            <span className="text-sm">{brand}</span>
          </div>
        )}
        {condition && (
          <div>
            <span className="text-sm text-muted-foreground">{t("condition")}: </span>
            <span className="text-sm">{conditionLabel}</span>
          </div>
        )}
        {approximateAge && (
          <div>
            <span className="text-sm text-muted-foreground">{t("age")}: </span>
            <span className="text-sm">{approximateAge}</span>
          </div>
        )}
        {description && <p className="text-sm">{description}</p>}
        {notes && (
          <p className="text-sm text-muted-foreground italic">{notes}</p>
        )}
        {formattedDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("lastUpdated")}: {formattedDate}</span>
          </div>
        )}
        {links.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <span className="text-sm font-medium">{t("links")}</span>
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {link.label || link.url}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
