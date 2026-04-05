import { requireUser } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout requires authentication
  await requireUser();
  return <>{children}</>;
}
