import { requireAdmin } from "@/lib/auth";
import { AdminSidebar } from "@/features/admin-dashboard/components/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <AdminSidebar />
      <div className="flex-1 p-6 md:p-8">{children}</div>
    </div>
  );
}
