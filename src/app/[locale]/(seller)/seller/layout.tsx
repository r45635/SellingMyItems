import { requireSeller } from "@/lib/auth";
import { SellerSidebar } from "@/features/seller-dashboard/components/seller-sidebar";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSeller();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <SellerSidebar />
      <div className="flex-1 p-6 md:p-8">{children}</div>
    </div>
  );
}
