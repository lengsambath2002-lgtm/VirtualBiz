'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

export type MethodKey = 'KHQR' | 'CARD' | 'COD' | 'CASH' | 'SPLIT';

/** Payment method label; KHQR is the shared brand name from `common.payments`. */
export function useMethodName() {
  const t = useTranslations('seller.methods');
  const tc = useTranslations('common.payments');
  return useCallback((k: MethodKey) => (k === 'KHQR' ? tc('khqr') : t(k)), [t, tc]);
}
