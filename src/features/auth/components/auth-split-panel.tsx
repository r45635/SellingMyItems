import { useTranslations } from "next-intl";
import { MapPinned, Heart, HandCoins, ShieldCheck } from "lucide-react";
import { SmiLogo } from "@/components/shared/smi-logo";

/**
 * Left panel rendered next to login / signup / forgot-password forms on
 * md+ screens. Brand-coloured gradient with tagline + 4 value props +
 * footer. Hidden on mobile.
 */
export function AuthSplitPanel() {
  const t = useTranslations("auth");
  const props = [
    { Icon: MapPinned, key: "valueLocal" as const },
    { Icon: Heart, key: "valueWishlist" as const },
    { Icon: HandCoins, key: "valueDirect" as const },
    { Icon: ShieldCheck, key: "valuePrivacy" as const },
  ];
  const year = new Date().getFullYear();

  return (
    <div
      className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-orange-500 to-orange-700 text-white"
      aria-hidden
    >
      <SmiLogo size="md" />
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-6">
          {t("brandTagline")}
        </h2>
        <ul className="space-y-4">
          {props.map(({ Icon, key }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <Icon className="h-4 w-4" />
              </span>
              <div className="text-sm">
                <p className="font-semibold">{t(`${key}Title`)}</p>
                <p className="text-white/80">{t(`${key}Desc`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-white/50">© {year} SellingMyItems</p>
    </div>
  );
}
