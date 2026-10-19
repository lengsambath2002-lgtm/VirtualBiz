'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * A cancellation / return reason code from the API (`customer.mistake`, `rejected.outOfStock`,
 * `auto`, `paymentExpired`, `paymentCancelled`, `returned.damaged`, `admin.cancel`, `admin.refund`) in the customer's language.
 */
export function useCancelReasonText() {
  const t = useTranslations('shop.order.why');
  return useCallback(
    (code: string) => {
      const [kind, key] = code.split('.');
      switch (kind) {
        case 'customer':
          return t('customer');
        case 'rejected':
          return key && t.has(`rejected.${key}` as never)
            ? t(`rejected.${key}` as 'rejected.outOfStock')
            : t('rejectedOther');
        case 'returned':
          return t('returned');
        case 'auto':
          return t('auto');
        case 'paymentExpired':
          return t('paymentExpired');
        case 'paymentCancelled':
          return t('paymentCancelled');
        case 'admin':
          return key === 'refund' ? t('adminRefund') : t('adminCancel');
        default:
          return t('other');
      }
    },
    [t],
  );
}
