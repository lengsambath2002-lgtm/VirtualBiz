'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * Cancel / return reasons are stored as codes ("rejected.outOfStock", "returned.damaged",
 * "auto", "customer") and shown in the UI language.
 */
export function useReasonText() {
  const t = useTranslations('seller.orders.reasons');
  return useCallback(
    (code: string) => {
      const [kind, key] = code.split('.');
      if (kind === 'rejected' && key)
        return t('rejectedPrefix', { reason: t(`reject.${key}` as 'reject.outOfStock') });
      if (kind === 'returned' && key) return t(`returned.${key}` as 'returned.damaged');
      if (kind === 'auto') return t('auto');
      if (kind === 'customer') return t('customer');
      // VirtualBiz support cancelled (admin.cancel) or refunded (admin.refund) it.
      if (kind === 'admin' && key) return t(`admin.${key}` as 'admin.cancel');
      return code;
    },
    [t],
  );
}
