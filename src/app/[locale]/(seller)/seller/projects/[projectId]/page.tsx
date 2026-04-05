import { redirect } from "next/navigation";

// Redirect /seller/projects/[id] to its items list
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/seller/projects/${projectId}/items`);
}
