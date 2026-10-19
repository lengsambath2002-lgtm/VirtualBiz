import { HelpPage } from '@/features/shop-layout/components/HelpPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('help');

export default function Page() {
  return <HelpPage />;
}
