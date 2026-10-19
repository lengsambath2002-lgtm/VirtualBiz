import { SearchPage } from '@/features/shop-search/components/SearchPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('search');

export default function Page() {
  return <SearchPage />;
}
