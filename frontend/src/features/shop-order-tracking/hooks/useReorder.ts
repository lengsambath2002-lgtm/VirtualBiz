'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { toast } from '@/features/shop-shared/store';
import type { ShopOrder } from '@/features/shop-shared/types';
import { useAddLine } from '@/features/shop-shared/useAddLine';

/** "Buy again": puts an order's lines back in the cart (each line subject to stock). */
export function useReorder() {
  const t = useTranslations('shop.toast');
  const addLine = useAddLine();
  return useCallback(
    (o: ShopOrder) => {
      let n = 0;
      o.lines.forEach((l) => {
        if (addLine(l.pid, l.sel, l.qty)) n++;
      });
      if (n) toast(t('added'), { label: t('viewCart'), href: '/cart' });
    },
    [addLine, t],
  );
}
