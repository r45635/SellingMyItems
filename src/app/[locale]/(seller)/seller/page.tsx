import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";

export default function SellerDashboardPage() {
  // Redirect to projects by default
  redirect("seller/projects");
}
