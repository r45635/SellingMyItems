import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  const sections = [
    { title: t("controllerTitle"), text: t("controllerText") },
    { title: t("dataTitle"), text: t("dataText") },
    { title: t("purposeTitle"), text: t("purposeText") },
    { title: t("thirdPartyTitle"), text: t("thirdPartyText") },
    { title: t("retentionTitle"), text: t("retentionText") },
    { title: t("rightsTitle"), text: t("rightsText") },
    { title: t("cookiesTitle"), text: t("cookiesText") },
    { title: t("contactTitle"), text: t("contactText") },
  ] as const;

  return (
    <div className="container max-w-2xl px-4 py-10">
      <h1 className="text-heading-2 mb-2">{t("title")}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t("lastUpdated")}</p>

      <p className="text-sm mb-8 leading-relaxed">{t("intro")}</p>

      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-base font-semibold mb-2">{s.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
