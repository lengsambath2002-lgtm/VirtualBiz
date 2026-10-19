import { ShopPage } from '@/features/admin-shops';

export default async function AdminShopRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShopPage id={id} />;
}
