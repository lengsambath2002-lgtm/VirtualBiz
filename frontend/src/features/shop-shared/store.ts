'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LatLng } from '@/lib/geo';

import type {
  AppliedPromo,
  BookingDraft,
  CartLine,
  CheckoutDraft,
  NotifKind,
  Selection,
  ShopNotif,
} from './types';

const sameSel = (a: Selection, b: Selection) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The customer's marketplace state, persisted to localStorage. The cart is the browser's for a
 * guest and a mirror of the server cart once signed in (`cartOwner`, synced by
 * `@/features/shop-cart/sync`). Orders and order notifications come from the API
 * (`@/features/shop-order-tracking/queries`, `@/features/notification`), and so do bookings
 * (`@/features/shop-service-booking/queries`), addresses, prefs and saved items.
 */
export interface ShopState {
  area: string;
  /** Exact delivery point from "Use my current location" (null = the district's centre). */
  here: LatLng | null;
  cart: CartLine[];
  later: CartLine[];
  /** User whose server cart `cart` / `later` mirror; null = a guest's own cart. */
  cartOwner: string | null;
  recent: string[];
  promo: AppliedPromo | null;
  /** Local inbox entries (welcome deal / promo); everything else comes from the API. */
  notifs: ShopNotif[];
  bk: BookingDraft | null;
  reschedOf: string | null;
  co: CheckoutDraft | null;

  set: (patch: Partial<ShopState>) => void;
  setArea: (area: string) => void;
  setHere: (here: LatLng | null, area?: string) => void;
  /** Adds qty of a product to the cart (caller checks stock). */
  addLine: (pid: string, sel: Selection, qty: number) => void;
  setCart: (cart: CartLine[]) => void;
  pushRecent: (id: string) => void;
  notify: (kind: NotifKind, params: Record<string, string>, href: string) => void;
  readNotif: (id: string) => void;
  readAll: () => void;
}

const initialNotifs = (): ShopNotif[] => {
  const now = Date.now();
  return [
    {
      id: 'n1',
      kind: 'deal',
      params: { shop: 'Happy Coffee' },
      href: '/shop/happy-coffee',
      unread: true,
      at: now - 5 * 60_000,
    },
    { id: 'n2', kind: 'promo', params: {}, href: '/cart', unread: true, at: now - 3 * 3_600_000 },
  ];
};

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      area: 'Toul Kork',
      here: null,
      cart: [],
      later: [],
      cartOwner: null,
      recent: ['latte', 'massage'],
      promo: null,
      notifs: initialNotifs(),
      bk: null,
      reschedOf: null,
      co: null,

      set: (patch) => set(patch),
      // Picking a district by hand drops the exact point.
      setArea: (area) => set({ area, here: null }),
      setHere: (here, area) => set(area ? { here, area } : { here }),
      addLine: (pid, sel, qty) =>
        set((s) => {
          const i = s.cart.findIndex((l) => l.pid === pid && sameSel(l.sel, sel));
          if (i < 0) return { cart: [...s.cart, { pid, sel: { ...sel }, qty, on: true }] };
          const cart = s.cart.slice();
          const l = cart[i]!;
          cart[i] = { ...l, qty: l.qty + qty, on: true };
          return { cart };
        }),
      setCart: (cart) => set({ cart }),
      pushRecent: (id) =>
        set((s) => (s.recent.includes(id) ? s : { recent: [id, ...s.recent].slice(0, 5) })),
      notify: (kind, params, href) =>
        set((s) => ({
          notifs: [
            { id: 'n' + Date.now(), kind, params, href, unread: true, at: Date.now() },
            ...s.notifs,
          ],
        })),
      readNotif: (id) =>
        set((s) => ({ notifs: s.notifs.map((n) => (n.id === id ? { ...n, unread: false } : n)) })),
      readAll: () => set((s) => ({ notifs: s.notifs.map((n) => ({ ...n, unread: false })) })),
    }),
    {
      name: 'vb-shop',
      // v2: addresses and prefs moved to the API. v3: saved items moved to the API and the
      // client-side `sold` stock adjustment went (the server's stock is authoritative).
      // v4: orders and their numbering moved to the API; the cart mirrors the server's.
      // v5: bookings moved to the API. v6: reviews moved to the API.
      version: 6,
      migrate: (persisted) => {
        const {
          addresses: _a,
          prefs: _p,
          saved: _s,
          sold: _o,
          orders: _or,
          seq: _q,
          bookings: _bk,
          myReviews: _mr,
          reviewedOrders: _ro,
          seededFor: _sf,
          notifs,
          ...rest
        } = (persisted ?? {}) as Record<string, unknown>;
        const local = ((notifs as ShopNotif[] | undefined) ?? initialNotifs()).filter((n) =>
          ['deal', 'promo'].includes(n.kind),
        );
        return {
          ...rest,
          notifs: local,
          cartOwner: null,
        } as unknown as ShopState;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({
        set: _set,
        setArea: _a,
        setHere: _sh,
        addLine: _b,
        setCart: _c,
        pushRecent: _e,
        notify: _f,
        readNotif: _g,
        readAll: _h,
        ...data
      }) => data,
    },
  ),
);

/** Non-persisted UI state: open header menu, toast. */
export type HeaderMenu = 'n' | 'u' | 'c' | null;
export interface ToastAction {
  label: string;
  href?: string;
  fn?: () => void;
}
interface UiState {
  menu: HeaderMenu;
  /** "Where should we deliver?" sheet. */
  loc: boolean;
  toast: { id: number; msg: string; action?: ToastAction } | null;
  setMenu: (m: HeaderMenu) => void;
  setLoc: (open: boolean) => void;
  showToast: (msg: string, action?: ToastAction) => void;
  hideToast: () => void;
}
export const useShopUi = create<UiState>()((set) => ({
  menu: null,
  loc: false,
  toast: null,
  setMenu: (menu) => set({ menu }),
  setLoc: (loc) => set({ loc }),
  showToast: (msg, action) =>
    set({ toast: { id: Date.now(), msg, ...(action ? { action } : {}) } }),
  hideToast: () => set({ toast: null }),
}));

export const toast = (msg: string, action?: ToastAction) =>
  useShopUi.getState().showToast(msg, action);
