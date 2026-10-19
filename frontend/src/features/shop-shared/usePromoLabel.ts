'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import type { Promotion } from '@/lib/domain';
import { formatUsdWhole } from '@/lib/money';

/** "10% off, up to $5" / "$5 off orders over $20" from a promotion's rule. */
export function usePromoLabel() {
  const t = useTranslations('shop.promo');
  return useCallback(
    (p: Pick<Promotion, 'type' | 'value' | 'minSpend' | 'maxDiscount'>) => {
      if (p.type === 'PERCENT')
        return p.maxDiscount != null
          ? t('pctCap', { pct: p.value, max: formatUsdWhole(p.maxDiscount) })
          : t('pct', { pct: p.value });
      if (p.type === 'FIXED')
        return p.minSpend != null
          ? t('flatMin', { amount: formatUsdWhole(p.value), min: formatUsdWhole(p.minSpend) })
          : t('flat', { amount: formatUsdWhole(p.value) });
      return t('freeShip');
    },
    [t],
  );
}
