import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { ImageOff } from "lucide-react";

interface ItemTeaserCardProps {
  title: string;
  coverImageUrl?: string | null;
  status?: "available" | "pending" | "sold";
  href?: string;
}

export function ItemTeaserCard({
  title,
  coverImageUrl,
  status = "available",
  href,
}: ItemTeaserCardProps) {
  const content = (
    <Card className="overflow-hidden transition-shadow hover:shadow-md group">
      <div className="aspect-square relative bg-muted">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageOff className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        {status !== "available" && (
          <Badge
            variant={status === "sold" ? "destructive" : "secondary"}
            className="absolute top-2 right-2"
          >
            {status}
          </Badge>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium text-sm line-clamp-2">{title}</h3>
      </CardContent>
    </Card>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}
