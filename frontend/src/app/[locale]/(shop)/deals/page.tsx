import { DealsPage } from '@/features/shop-deals/components/DealsPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('deals');

export default function Page() {
  return <DealsPage />;
}
