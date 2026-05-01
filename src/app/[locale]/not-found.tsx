import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { SmiLogo } from "@/components/shared/smi-logo";

export default function LocaleNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <SmiLogo size="lg" />
      <div className="space-y-2">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="text-lg text-muted-foreground">
          This page could not be found.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Go home
      </Link>
    </div>
  );
}
