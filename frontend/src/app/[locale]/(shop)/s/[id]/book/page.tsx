import { ConfirmBookingPage } from '@/features/shop-service-booking/components/ConfirmBookingPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('book');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfirmBookingPage id={decodeURIComponent(id)} />;
}
