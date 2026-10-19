import { OrderPage } from '@/features/shop-order-tracking/components/OrderPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('order');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderPage number={decodeURIComponent(id)} />;
}
