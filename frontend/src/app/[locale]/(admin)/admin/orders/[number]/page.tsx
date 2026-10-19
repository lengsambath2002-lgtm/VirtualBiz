import { OrderPage } from '@/features/admin-orders';

export default async function AdminOrderRoute({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <OrderPage number={decodeURIComponent(number)} />;
}
