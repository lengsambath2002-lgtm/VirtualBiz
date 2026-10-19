import { Suspense } from 'react';

import { InventoryPage } from '@/features/seller-inventory';

export default function SellerInventoryRoute() {
  return (
    <Suspense>
      <InventoryPage />
    </Suspense>
  );
}
