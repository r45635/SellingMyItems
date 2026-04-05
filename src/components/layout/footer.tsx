import { SmiLogo } from "@/components/shared/smi-logo";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-16 md:flex-row md:py-0">
        <SmiLogo size="sm" />
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SellingMyItems
        </p>
      </div>
    </footer>
  );
}
