"use client";

import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BuildInfo() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "—";

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Info className="h-3 w-3" />
        <span>About</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>About</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Build</span>
            <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
              {buildId}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>{buildDate}</span>
          </div>
          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            SellingMyItems — Marketplace App
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
