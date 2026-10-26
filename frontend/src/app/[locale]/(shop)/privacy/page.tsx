import { LegalPage } from '@/features/legal';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('privacy');

export default function Page() {
  return <LegalPage page="privacy" />;
}
