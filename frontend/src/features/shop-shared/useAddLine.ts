'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { useShopData } from './hooks';
import { toast, useShopStore } from './store';
import type { Selection } from './types';

/**
 * Adds a product line to the cart, refusing (with the prototype's toast) when the cart would
 * hold more units than the shop has in stock. Returns whether it was added.
 */
export function useAddLine() {
  const t = useTranslations('shop.toast');
  const { item } = useShopData();
  return useCallback(
    (pid: string, sel: Selection, qty: number, opts: { silent?: boolean } = {}) => {
      const it = item(pid);
      if (!it) return false;
      const inCart = useShopStore
        .getState()
        .cart.filter((l) => l.pid === pid)
        .reduce((a, l) => a + l.qty, 0);
      if (inCart + qty > it.stock) {
        if (!opts.silent)
          toast(
            inCart
              ? t('onlyAvailableIn', { n: it.stock, inCart })
              : t('onlyAvailable', { n: it.stock }),
          );
        return false;
      }
      useShopStore.getState().addLine(pid, sel, qty);
      return true;
    },
    [item, t],
  );
}
