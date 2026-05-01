import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Eye } from "lucide-react";
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
  viewCount?: number;
  isReservedForCurrentUser?: boolean;
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
  viewCount,
  isReservedForCurrentUser,
}: ItemDetailCardProps) {
  const t = useTranslations("item");

  const formattedPrice =
    price != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: price % 1 === 0 ? 0 : 2,
        }).format(price)
      : null;

  const formattedOriginalPrice =
    originalPrice != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: originalPrice % 1 === 0 ? 0 : 2,
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
        <div className="flex items-center gap-2">
          <Badge
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status === "reserved"
                ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                : status === "sold"
                  ? "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100"
                  : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block mr-1.5" />
            {isReservedForCurrentUser && status === "reserved" ? t("reservedForYou") : statusLabel}
          </Badge>
          {status === "reserved" && (
            <span className="text-xs text-muted-foreground">
              · {isReservedForCurrentUser ? t("youAreBuyingThis") : t("reservedSubtle")}
            </span>
          )}
        </div>
        <CardTitle className="text-xl md:text-2xl font-extrabold tracking-tight mt-2">
          {title}
        </CardTitle>
        {(formattedPrice || formattedOriginalPrice) && (
          <div className="flex items-baseline gap-2">
            {formattedPrice && (
              <p className="text-3xl font-extrabold text-orange-600">{formattedPrice}</p>
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
          <div className="bg-orange-50 border-l-2 border-orange-400 rounded-r-lg px-3 py-2 text-xs text-orange-900 italic leading-relaxed dark:bg-orange-950/30 dark:text-orange-200 dark:border-orange-600">
            📌 {notes}
          </div>
        )}
        {(formattedDate || viewCount != null) && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            {formattedDate && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{t("lastUpdated")}: {formattedDate}</span>
              </div>
            )}
            {viewCount != null && (
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                <span>{viewCount} {t("views")}</span>
              </div>
            )}
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
