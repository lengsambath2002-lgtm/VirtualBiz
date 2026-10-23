'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { formatUsd } from '@/lib/money';

import { useCancelReasonText } from '@/features/shop-order-tracking/hooks/useCancelReasonText';
import { useShopStore } from '@/features/shop-shared/store';
import type { ShopNotif } from '@/features/shop-shared/types';

import { useMyNotifications, useReadAllNotifications, useReadNotification } from '../queries';

/** Server kinds and their message keys under `shop.notif`. */
const SERVER_KINDS: Record<string, string> = {
  ORDER_PLACED: 'orderPlaced',
  ORDER_ACCEPTED: 'orderAccepted',
  ORDER_READY_PICKUP: 'readyPickup',
  ORDER_ON_THE_WAY: 'onTheWay',
  ORDER_DELIVERED: 'orderDelivered',
  ORDER_PICKED_UP: 'orderPickedUp',
  ORDER_CANCELLED: 'orderCancelled',
  ORDER_RETURNED: 'orderReturned',
  BOOKING_REQUESTED: 'requested',
  BOOKING_CONFIRMED: 'booked',
  BOOKING_DECLINED: 'bookingDeclined',
  BOOKING_CANCELLED: 'bookingCancelled',
  BOOKING_CHANGED: 'bookingChanged',
  BOOKING_REMINDER: 'bookingReminder',
};

const BOOKING_REASONS = [
  'fullyBooked',
  'stylistNA',
  'notOffered',
  'clientAsked',
  'stylistUnavailable',
  'shopClosed',
] as const;

/**
 * The customer's bell: order and booking entries from the API merged with the local ones (the
 * welcome deal and promo), newest first, with read / read-all for both.
 */
export function useInbox() {
  const tn = useTranslations('shop.notif');
  const tr = useTranslations('shop.bookingReason');
  const locale = useLocale();
  const why = useCancelReasonText();
  const local = useShopStore((st) => st.notifs);
  const { data: server = [] } = useMyNotifications();
  const read = useReadNotification();
  const readAll = useReadAllNotifications();

  const items: ShopNotif[] = useMemo(
    () =>
      [
        ...local,
        ...server
          .filter((n) => SERVER_KINDS[n.kind])
          .map((n) => ({
            id: n.id,
            kind: n.kind,
            params: n.params,
            href: n.route,
            unread: n.unread,
            at: Date.parse(n.at),
          })),
      ].sort((a, b) => b.at - a.at),
    [local, server],
  );

  const text = useCallback(
    (n: ShopNotif) => {
      const key = SERVER_KINDS[n.kind];
      if (!key) return tn(n.kind as 'deal', n.params);
      const params: Record<string, string> = { ...n.params };
      if (n.kind.startsWith('BOOKING_')) {
        // Booking params: service, shop, date (YYYY-MM-DD), time (HH:mm), reason code.
        const day = n.params.date
          ? new Date(`${n.params.date}T00:00:00`).toLocaleDateString(
              locale === 'kh' ? 'km-KH' : 'en-GB',
              {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              },
            )
          : '';
        params.name = n.params.service ?? '';
        params.when = `${day} ${n.params.time ?? ''}`.trim();
        const r = n.params.reason as (typeof BOOKING_REASONS)[number] | undefined;
        params.reason = r && BOOKING_REASONS.includes(r) ? tr(r) : '';
        // The shop's own words when it declined (free text, shown as written).
        params.message = n.params.message ? `“${n.params.message}”` : '';
        return tn(key as 'booked', params);
      }
      if (n.params.reason) params.reason = why(n.params.reason);
      if (n.params.amount) params.amount = formatUsd(Number(n.params.amount));
      return tn(key as 'orderAccepted', params);
    },
    [tn, tr, why, locale],
  );

  const isServer = useCallback((id: string) => server.some((n) => n.id === id), [server]);

  return {
    items,
    unread: items.filter((n) => n.unread).length,
    text,
    read: (id: string) => (isServer(id) ? read.mutate(id) : useShopStore.getState().readNotif(id)),
    readAll: () => {
      useShopStore.getState().readAll();
      if (server.some((n) => n.unread)) readAll.mutate();
    },
  };
}
