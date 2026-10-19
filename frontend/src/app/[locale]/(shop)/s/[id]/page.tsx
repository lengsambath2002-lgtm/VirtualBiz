import { ServicePage } from '@/features/shop-service-booking/components/ServicePage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('service');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServicePage id={decodeURIComponent(id)} />;
}
