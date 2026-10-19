import { UserPage } from '@/features/admin-users';

export default async function AdminUserRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserPage id={id} />;
}
