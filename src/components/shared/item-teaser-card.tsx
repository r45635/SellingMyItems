import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { ImageOff, Heart, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";

interface ItemTeaserCardProps {
  title: string;
  coverImageUrl?: string | null;
  status?: "available" | "pending" | "reserved" | "sold" | "hidden";
  statusLabel?: string;
  href?: string;
  updatedAt?: Date | string | null;
  isWishlisted?: boolean;
  viewCount?: number;
  wishlistButton?: React.ReactNode;
  isReservedForCurrentUser?: boolean;
  price?: number | null;
  currency?: string;
}

export function ItemTeaserCard({
  title,
  coverImageUrl,
  status = "available",
  statusLabel,
  href,
  updatedAt,
  isWishlisted,
  viewCount,
  wishlistButton,
  isReservedForCurrentUser,
  price,
  currency,
}: ItemTeaserCardProps) {
  const t = useTranslations("item");

  const formattedDate = updatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt
      )
    : null;

  const label = statusLabel || t(status);

  const content = (
    <Card className="overflow-hidden transition-all hover:shadow-lg group border-0 shadow-sm">
      <div className="aspect-[4/3] relative bg-muted">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageOff className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        {status !== "available" && (
          <Badge
            variant={status === "sold" ? "destructive" : status === "hidden" ? "outline" : "secondary"}
            className={`absolute top-2 right-2 shadow-sm ${
              status === "reserved"
                ? isReservedForCurrentUser
                  ? "bg-red-600 text-white border-red-600 hover:bg-red-600 font-bold text-xs px-2.5 py-1 animate-pulse"
                  : "bg-red-600 text-white border-red-600 hover:bg-red-600 font-bold text-xs px-2.5 py-1"
                : status === "sold"
                  ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-900 font-bold text-xs px-2.5 py-1"
                  : ""
            }`}
          >
            {isReservedForCurrentUser && status === "reserved" ? t("reservedForYou") : label}
          </Badge>
        )}
        {wishlistButton ? (
          wishlistButton
        ) : isWishlisted ? (
          <div className="absolute top-2 left-2">
            <Heart className="h-5 w-5 fill-red-500 text-red-500 drop-shadow" />
          </div>
        ) : null}
      </div>
      <CardContent className="p-2.5">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-orange-600 transition-colors">{title}</h3>
        {price != null && (
          <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-1">
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: currency ?? "USD",
              maximumFractionDigits: 0,
            }).format(price)}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          {formattedDate ? (
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          ) : (
            <span />
          )}
          {viewCount != null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {viewCount}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}
