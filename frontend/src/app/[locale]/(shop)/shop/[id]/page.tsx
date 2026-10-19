import { StorePage } from '@/features/shop-store/components/StorePage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('shop');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StorePage id={decodeURIComponent(id)} />;
}
