'use client';

import { NotificationHistory } from '@/features/business-inbox';
import { useDb, useGo, useSellerStore, type SellerNotification } from '@/features/seller-shared';
import { useNotifText } from '@/features/seller-shell';

/** `/seller/notifications`: the shop's whole inbox. */
export function NotificationsPage() {
  const db = useDb();
  const go = useGo();
  const text = useNotifText();
  return (
    <NotificationHistory
      businessId={db.shop.id}
      text={(n) => text(n as unknown as SellerNotification)}
      onOpen={(n) => void go(n.route.replace(/\?order=.*$/, ''))}
      onRead={(id) =>
        useSellerStore.setState((st) =>
          st.db
            ? {
                db: {
                  ...st.db,
                  notifs: st.db.notifs.map((x) =>
                    !id || x.id === id ? { ...x, unread: false } : x,
                  ),
                },
              }
            : st,
        )
      }
    />
  );
}
