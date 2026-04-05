import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { ImageCarousel } from "./image-carousel";

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
  status?: "available" | "pending" | "sold";
  categoryName?: string | null;
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
}: ItemDetailCardProps) {
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

  return (
    <Card className="overflow-hidden">
      <ImageCarousel images={allImages} title={title} />

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant={status === "sold" ? "destructive" : status === "pending" ? "secondary" : "default"}>
            {status}
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
            <span className="text-sm text-muted-foreground">Category: </span>
            <Badge variant="outline">{categoryName}</Badge>
          </div>
        )}
        {brand && (
          <div>
            <span className="text-sm text-muted-foreground">Brand: </span>
            <span className="text-sm">{brand}</span>
          </div>
        )}
        {condition && (
          <div>
            <span className="text-sm text-muted-foreground">Condition: </span>
            <span className="text-sm">{condition}</span>
          </div>
        )}
        {approximateAge && (
          <div>
            <span className="text-sm text-muted-foreground">Age: </span>
            <span className="text-sm">{approximateAge}</span>
          </div>
        )}
        {description && <p className="text-sm">{description}</p>}
        {notes && (
          <p className="text-sm text-muted-foreground italic">{notes}</p>
        )}
        {links.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <span className="text-sm font-medium">Links</span>
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
