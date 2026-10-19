import { Suspense } from 'react';

import { OrdersPage } from '@/features/seller-orders';

export default function SellerOrdersRoute() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
