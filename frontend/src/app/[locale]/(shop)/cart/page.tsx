import { CartPage } from '@/features/shop-cart/components/CartPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('cart');

export default function Page() {
  return <CartPage />;
}
