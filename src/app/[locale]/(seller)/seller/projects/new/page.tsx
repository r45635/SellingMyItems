import { useTranslations } from "next-intl";
import { ProjectForm } from "@/features/projects/components/project-form";

export default function NewProjectPage() {
  const t = useTranslations("seller");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("createProject")}</h1>
      <ProjectForm />
    </div>
  );
}
