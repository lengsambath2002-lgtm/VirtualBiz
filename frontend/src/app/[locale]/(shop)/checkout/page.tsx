import { CheckoutPage } from '@/features/shop-checkout/components/CheckoutPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('checkout');

export default function Page() {
  return <CheckoutPage />;
}
