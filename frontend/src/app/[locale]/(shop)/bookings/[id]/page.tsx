import { BookingDetailPage } from '@/features/shop-service-booking/components/BookingDetailPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('booking');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetailPage number={decodeURIComponent(id)} />;
}
