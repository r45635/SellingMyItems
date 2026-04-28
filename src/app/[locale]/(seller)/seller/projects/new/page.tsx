import { getTranslations } from "next-intl/server";
import { ProjectForm } from "@/features/projects/components/project-form";
import { requireUser, getUserCapabilities } from "@/lib/auth";
import { Sparkles } from "lucide-react";

export default async function NewProjectPage() {
  const t = await getTranslations("seller");
  const tOnboarding = await getTranslations("sellerOnboarding");
  const user = await requireUser();
  const caps = await getUserCapabilities(user);

  // First-time creator: no sellerAccount yet. The act of submitting this
  // form will mint one — we just need to set expectations softly here so
  // the user knows their listing won't be public until admin approval.
  const isFirstTimeCreator = !caps.seller;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("createProject")}</h1>

      {isFirstTimeCreator && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                {tOnboarding("firstProjectTitle")}
              </p>
              <p className="mt-1 text-xs text-orange-800/90 dark:text-orange-200/80">
                {tOnboarding("firstProjectBody")}
              </p>
            </div>
          </div>
        </div>
      )}

      <ProjectForm />
    </div>
  );
}
