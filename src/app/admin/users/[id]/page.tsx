import { AdminUserDetailView } from "@/components/admin/admin-user-detail";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminUserDetailView id={id} />;
}
