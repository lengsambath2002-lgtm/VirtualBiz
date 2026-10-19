'use client';

import { isUpcoming } from '@/features/shop-service-booking/components/ServicePage';
import { useMyBookings } from '@/features/shop-service-booking/queries';
import { useMyOrders } from '@/features/shop-order-tracking/queries';
import { useSavedKeys } from '@/features/shop-shared/saved';
import type { ShopOrder } from '@/features/shop-shared/types';

import { useAddresses } from '../queries';

/** Order bucket for the Orders filter tabs. */
export type OrderBucket = 'active' | 'done' | 'cancelled';
export const orderBucket = (o: ShopOrder): OrderBucket =>
  o.status === 'CANCELLED' ? 'cancelled' : o.step >= 5 ? 'done' : 'active';

/** The numbers the account menu, sidebar and overview show. */
export function useAccountCounts() {
  const { data: orders = [] } = useMyOrders();
  const { bookings } = useMyBookings();
  const saved = useSavedKeys();
  const { data: addresses = [] } = useAddresses();
  return {
    orders: orders.length,
    activeOrders: orders.filter((o) => orderBucket(o) === 'active').length,
    upcomingBookings: bookings.filter(isUpcoming).length,
    saved: saved.filter((k) => !k.startsWith('shop:')).length,
    addresses: addresses.length,
  };
}
