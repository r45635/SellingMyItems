import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SmiLogo } from "@/components/shared/smi-logo";
import { BuildInfo } from "@/components/shared/build-info";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t bg-muted/30">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-16 md:flex-row md:py-0">
        <SmiLogo size="sm" />
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SellingMyItems
          </p>
          <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            {t("terms")}
          </Link>
          <BuildInfo />
        </div>
      </div>
    </footer>
  );
}
