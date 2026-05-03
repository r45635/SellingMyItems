import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("title") };
}

export default async function TermsPage() {
  const t = await getTranslations("terms");

  const sections = [
    { title: t("acceptanceTitle"), text: t("acceptanceText") },
    { title: t("descriptionTitle"), text: t("descriptionText") },
    { title: t("accountTitle"), text: t("accountText") },
    { title: t("contentTitle"), text: t("contentText") },
    { title: t("prohibitedTitle"), text: t("prohibitedText") },
    { title: t("liabilityTitle"), text: t("liabilityText") },
    { title: t("terminationTitle"), text: t("terminationText") },
    { title: t("changesTitle"), text: t("changesText") },
  ] as const;

  return (
    <div className="container max-w-2xl px-4 py-10">
      <h1 className="text-heading-2 mb-2">{t("title")}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t("lastUpdated")}</p>

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
