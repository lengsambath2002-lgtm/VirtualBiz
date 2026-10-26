import { LegalPage } from '@/features/legal';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('terms');

export default function Page() {
  return <LegalPage page="terms" />;
}
