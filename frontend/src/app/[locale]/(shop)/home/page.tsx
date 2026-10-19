import { HomePage } from '@/features/shop-home/components/HomePage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('home');

export default function Page() {
  return <HomePage />;
}
