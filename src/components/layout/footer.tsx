import { SmiLogo } from "@/components/shared/smi-logo";
import { BuildInfo } from "@/components/shared/build-info";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-16 md:flex-row md:py-0">
        <SmiLogo size="sm" />
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SellingMyItems
          </p>
          <BuildInfo />
        </div>
      </div>
    </footer>
  );
}
