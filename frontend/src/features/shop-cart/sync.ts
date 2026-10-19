'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '@/lib/auth';

import { CATALOG_KEY } from '@/features/shop-shared/hooks';
import { useShopStore } from '@/features/shop-shared/store';
import type { Catalog, Item } from '@/features/shop-shared/types';

import { fetchCart, fromApiCart, mergeCart, replaceCart, toCartInput } from './queries';
import { rebase } from './rebase';

const PUSH_DELAY_MS = 400;

/** Writes server lines into the store without echoing them back as a PUT. */
let applying = false;
function apply(next: ReturnType<typeof fromApiCart>, owner: string | null) {
  applying = true;
  try {
    useShopStore.setState({ ...next, cartOwner: owner });
  } finally {
    applying = false;
  }
}

/**
 * Keeps the store's cart and the server cart in step (call once, in the shop shell, after the
 * catalogue and the session are ready):
 * - a guest's cart stays in the browser;
 * - on sign-in it is merged into the account's server cart (`POST /api/me/cart/merge`);
 * - while signed in, the server cart is loaded on start and every change is mirrored with a
 *   debounced `PUT /api/me/cart`;
 * - on sign-out the mirrored cart leaves the browser.
 */
export function useCartSync(ready: boolean) {
  const qc = useQueryClient();
  const { user } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!ready) return;
    const lookup = () => {
      const cat = qc.getQueryData<Catalog>(CATALOG_KEY);
      const byId = new Map((cat?.items ?? []).map((i) => [i.id, i] as const));
      return (id: string): Item | undefined => byId.get(id);
    };
    const st = useShopStore.getState();
    if (!userId) {
      if (st.cartOwner) apply({ cart: [], later: [] }, null);
      return;
    }
    let cancelled = false;
    // What the cart was when the load started: changes made meanwhile are re-applied on top.
    const base = { cart: st.cart, later: st.later };
    const load =
      st.cartOwner === userId
        ? fetchCart()
        : st.cartOwner === null && (st.cart.length || st.later.length)
          ? mergeCart(toCartInput(st.cart, st.later, lookup()))
          : fetchCart();
    load
      .then((c) => {
        if (cancelled) return;
        const server = fromApiCart(c);
        const now = useShopStore.getState();
        if (now.cart === base.cart && now.later === base.later) {
          apply(server, userId);
          return;
        }
        // The customer changed the cart while it loaded: keep those changes and save them.
        const merged = {
          cart: rebase(server.cart, base.cart, now.cart),
          later: rebase(server.later, base.later, now.later),
        };
        apply(merged, userId);
        void replaceCart(toCartInput(merged.cart, merged.later, lookup())).catch(() => {});
      })
      .catch(() => {
        /* offline: keep the local cart; the next change or reload syncs it */
      });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useShopStore.subscribe((s, prev) => {
      if (applying || s.cartOwner !== userId) return;
      if (s.cart === prev.cart && s.later === prev.later) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const now = useShopStore.getState();
        void replaceCart(toCartInput(now.cart, now.later, lookup())).catch(() => {});
      }, PUSH_DELAY_MS);
    });
    return () => {
      cancelled = true;
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [ready, userId, qc]);
}
