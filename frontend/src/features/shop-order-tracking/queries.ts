'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api, type ApiOrder } from '@/lib/api';
import { useSession } from '@/lib/auth';

import { refreshCatalog } from '@/features/shop-shared/hooks';
import type { ShopOrder } from '@/features/shop-shared/types';

// The customer's orders (docs/api/phase3-orders-checkout.md § Customer). Keys start with the
// user id so another account never sees a cached answer; the live stream invalidates them.

export const ordersKey = (userId: string | undefined) => ['me', userId, 'orders'] as const;
export const orderKey = (userId: string | undefined, number: string) =>
  ['me', userId, 'orders', number] as const;

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : 0);

/** Tracking step (1–5) of an order: placed, confirmed, preparing, on the way / ready, done. */
export function stepOf(o: Pick<ApiOrder, 'status' | 'method' | 'timeline'>): number {
  const pickup = o.method === 'PICKUP';
  switch (o.status) {
    case 'NEW':
      return 1;
    case 'ACCEPTED':
      return 3;
    case 'PACKED':
      return pickup ? 4 : 3;
    case 'SHIPPED':
      return 4;
    case 'DELIVERED':
    case 'PICKED_UP':
    case 'RETURNED':
      return 5;
    case 'CANCELLED': {
      // Where it was when it was cancelled.
      const before = [...o.timeline].reverse().find((e) => e.status !== 'CANCELLED');
      return before ? stepOf({ ...o, status: before.status }) : 1;
    }
  }
}

/** API order → the customer screens' shape (slugs as ids, ms times, the 5-step timeline). */
export function toShopOrder(o: ApiOrder): ShopOrder {
  const pickup = o.method === 'PICKUP';
  const placed = ms(o.placedAt ?? o.createdAt);
  const accepted = ms(o.acceptedAt);
  const ready = pickup ? ms(o.packedAt) : ms(o.shippedAt);
  const times = [placed, accepted, accepted, ready, ms(o.fulfilledAt)];
  return {
    id: o.id,
    number: o.number,
    businessId: o.shop.slug,
    shopName: o.shop.name,
    at: placed,
    lines: o.lines.map((l) => ({
      pid: l.productSlug,
      variantId: l.variantId,
      title: l.title,
      sel: l.options,
      qty: l.qty,
      unitPrice: l.unitPrice,
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    promo: o.promoDiscount,
    ...(o.promoCode ? { promoCode: o.promoCode } : {}),
    deliveryFee: o.deliveryFee,
    total: o.total,
    payment: {
      method: o.payment.method,
      channel: o.payment.channel,
      paid: o.payment.paid,
      status: o.payment.status,
    },
    method: o.method,
    ...(o.address
      ? {
          address: {
            label: o.address.label,
            name: o.address.name,
            phone: o.address.phone,
            line: o.address.line,
            district: o.address.district,
            ...(o.address.note ? { note: o.address.note } : {}),
          },
        }
      : {}),
    window: o.window ?? null,
    ...(o.note ? { note: o.note } : {}),
    step: stepOf(o),
    times: times.map((t) => t || 0),
    status: o.status,
    ...(o.cancelledAt ? { cancelledAt: ms(o.cancelledAt) } : {}),
    ...(o.cancelReason ? { cancelReason: o.cancelReason } : {}),
    canCancel: o.canCancel,
    ...(o.rider ? { rider: o.rider } : {}),
    reviewed: o.reviewed,
  };
}

const listMine = async () =>
  (await api.get<ApiOrder[]>('/me/orders')).map(toShopOrder).sort((a, b) => b.at - a.at);

/** `GET /api/me/orders`: every placed order, newest first (empty when signed out). */
export function useMyOrders() {
  const { user } = useSession();
  return useQuery({
    queryKey: ordersKey(user?.id),
    queryFn: listMine,
    enabled: !!user,
    staleTime: 15_000,
  });
}

/** `GET /api/me/orders/{number}`. */
export function useMyOrder(number: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: orderKey(user?.id, number),
    queryFn: async () => toShopOrder(await api.get<ApiOrder>(`/me/orders/${number}`)),
    enabled: !!user,
    retry: false,
  });
}

/** Refetch the orders (and the stock they changed) after an order event. */
export function refreshOrders(qc: QueryClient, userId: string | undefined) {
  void qc.invalidateQueries({ queryKey: ordersKey(userId) });
}

/** `POST /api/me/orders/{number}/cancel` (while NEW and within 5 minutes). */
export function useCancelOrder() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: ({ number, reason }: { number: string; reason: string }) =>
      api.post<ApiOrder>(`/me/orders/${number}/cancel`, { reason }),
    onSuccess: (o) => {
      qc.setQueryData(orderKey(user?.id, o.number), toShopOrder(o));
      refreshOrders(qc, user?.id);
      void refreshCatalog(qc);
    },
  });
}
