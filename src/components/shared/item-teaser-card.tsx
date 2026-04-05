import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { ImageOff } from "lucide-react";

interface ItemTeaserCardProps {
  title: string;
  coverImageUrl?: string | null;
  status?: "available" | "pending" | "reserved" | "sold" | "hidden";
  href?: string;
}

export function ItemTeaserCard({
  title,
  coverImageUrl,
  status = "available",
  href,
}: ItemTeaserCardProps) {
  const content = (
    <Card className="overflow-hidden transition-all hover:shadow-lg group border-0 shadow-sm">
      <div className="aspect-square relative bg-muted">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageOff className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        {status !== "available" && (
          <Badge
            variant={status === "sold" ? "destructive" : status === "hidden" ? "outline" : "secondary"}
            className="absolute top-2 right-2 shadow-sm"
          >
            {status}
          </Badge>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium text-base sm:text-sm line-clamp-2 group-hover:text-orange-600 transition-colors">{title}</h3>
      </CardContent>
    </Card>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}
