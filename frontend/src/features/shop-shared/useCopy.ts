'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { toast } from './store';

/** Copies text (phone numbers, promo codes) and confirms with a toast. */
export function useCopy() {
  const t = useTranslations('shop.toast');
  return useCallback(
    async (v: string) => {
      try {
        await navigator.clipboard.writeText(v);
        toast(t('copied', { v }));
      } catch {
        toast(v);
      }
    },
    [t],
  );
}
