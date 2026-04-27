import { requireUser } from "@/lib/auth";
import { SellerSidebar } from "@/features/seller-dashboard/components/seller-sidebar";
import { SellerMobileNav } from "@/features/seller-dashboard/components/seller-mobile-nav";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Anyone signed in can access the listings area — selling is no longer
  // gated by the legacy `seller` role. The first time they create a project
  // we lazily mint their sellerAccount row (see createProjectAction).
  await requireUser();

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)]">
      <SellerMobileNav />
      <SellerSidebar />
      <div className="flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
