'use client';

import { NotificationHistory } from '@/features/business-inbox';
import { useData, useProviderStore } from '@/features/provider-shared/store';
import type { ProviderNotification } from '@/features/provider-shared/types';
import { useProviderNotifText } from '@/features/provider-workspace';
import { useRouter } from '@/lib/i18n/navigation';

/** `/provider/notifications`: the shop's whole inbox. */
export function NotificationsPage() {
  const d = useData();
  const router = useRouter();
  const text = useProviderNotifText();
  return (
    <NotificationHistory
      businessId={d.business.id}
      text={(n) => text(n as unknown as ProviderNotification)}
      onOpen={(n) => router.push(n.route)}
      onRead={(id) =>
        useProviderStore.getState().update((x) => {
          x.notifications.forEach((m) => {
            if (!id || m.id === id) m.unread = false;
          });
        })
      }
    />
  );
}
