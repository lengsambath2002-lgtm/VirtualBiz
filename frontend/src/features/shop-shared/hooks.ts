'use client';

import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';

import { login } from '@/features/auth';
import { isApiError, metaNumber } from '@/lib/api';
import { useSession, useSessionStore } from '@/lib/auth';
import type { User } from '@/lib/domain';
import { formatUsd, formatUsdAsKhr } from '@/lib/money';
import { formatPhone } from '@/lib/utils/phone';

import { loadCatalog } from './catalog';
import { DAY_MS } from './rules';
import type { Catalog, Item, ShopView } from './types';

export const CATALOG_KEY = ['shop', 'catalog'] as const;

/**
 * The marketplace catalogue from the API. Live stock is the server's count, so the catalogue
 * is refetched when it is 30 s old and the page regains focus or remounts.
 * Phase 3: placing or cancelling an order invalidates CATALOG_KEY (see `refreshCatalog`).
 */
export function useCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: loadCatalog,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Refetch the catalogue (server stock) after something changed it. */
export const refreshCatalog = (qc: QueryClient) => qc.invalidateQueries({ queryKey: CATALOG_KEY });

export interface ShopData extends Catalog {
  /** Listing by slug, with the server's live stock. */
  item: (id: string) => Item | undefined;
  shop: (id: string) => ShopView | undefined;
}

const EMPTY_CATALOG: Catalog = {
  items: [],
  shops: [],
  districts: [],
  districtIds: {},
  categories: [],
  deals: [],
  promos: [],
};

/** Catalog + lookups. Only call below the shop shell (which waits for the catalog). */
export function useShopData(): ShopData {
  const { data } = useCatalog();
  return useMemo(() => {
    const cat = data ?? EMPTY_CATALOG;
    const byId = new Map(cat.items.map((i) => [i.id, i]));
    const shops = new Map(cat.shops.map((s) => [s.id, s]));
    return { ...cat, item: (id) => byId.get(id), shop: (id) => shops.get(id) };
  }, [data]);
}

const intlTag = (locale: string) => (locale === 'kh' ? 'km-KH' : 'en-GB');

/** Locale-aware formatters for money, dates and names. */
export function useFmt() {
  const locale = useLocale();
  const t = useTranslations('shop.time');
  const tc = useTranslations('common');
  const { districtIds: ids, categories } = useShopData();
  const tag = intlTag(locale);
  const fmtD = useCallback(
    (ms: number) =>
      new Date(ms).toLocaleDateString(tag, { weekday: 'short', day: 'numeric', month: 'short' }),
    [tag],
  );
  const fmtDT = useCallback(
    (ms: number) =>
      new Date(ms).toLocaleString(tag, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [tag],
  );
  const time = useCallback(
    (ms: number) => new Date(ms).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' }),
    [tag],
  );
  const weekday = useCallback(
    (ms: number) => new Date(ms).toLocaleDateString(tag, { weekday: 'short' }),
    [tag],
  );
  const ago = useCallback(
    (at: number) => {
      const d = Date.now() - at;
      if (d < 3_600_000) return t('minAgo', { n: Math.max(1, Math.round(d / 60_000)) });
      if (d < DAY_MS) return t('hAgo', { n: Math.round(d / 3_600_000) });
      const n = Math.round(d / DAY_MS);
      return n === 1
        ? t('yesterday')
        : n < 30
          ? t('daysAgo', { n })
          : new Date(at).toLocaleDateString(tag, { day: 'numeric', month: 'short' });
    },
    [t, tag],
  );
  const district = useCallback(
    (name: string) => {
      const id = ids[name];
      return id && tc.has(`districts.${id}` as never) ? tc(`districts.${id}` as never) : name;
    },
    [ids, tc],
  );
  // Category names come from the API (a super-admin edits them); message keys cover older ids.
  const category = useCallback(
    (id: string) => {
      const c = categories.find((x) => x.id === id);
      if (c) return locale === 'kh' ? c.nameKh || c.name : c.name;
      return tc.has(`categories.${id}` as never) ? tc(`categories.${id}` as never) : id;
    },
    [categories, locale, tc],
  );
  return {
    money: formatUsd,
    khr: formatUsdAsKhr,
    phone: formatPhone,
    fmtD,
    fmtDT,
    time,
    weekday,
    ago,
    district,
    category,
  };
}

// ---- Login gate ------------------------------------------------------------------------

/** Why the login sheet is open (message key under shop.login.why) and what to do after. */
export type AuthReason =
  | 'continue'
  | 'saveItems'
  | 'followShops'
  | 'checkOut'
  | 'book'
  | 'writeReview'
  | 'getAlerts';
interface AuthGateState {
  open: { why: AuthReason; then: () => void } | null;
  ask: (why: AuthReason, then: () => void) => void;
  close: () => void;
}
export const useAuthGate = create<AuthGateState>()((set) => ({
  open: null,
  ask: (why, then) => set({ open: { why, then } }),
  close: () => set({ open: null }),
}));

/** `needAuth(why, then)`: runs `then` now when signed in, else after the login sheet. */
export function useNeedAuth() {
  const { signedIn } = useSession();
  const ask = useAuthGate((s) => s.ask);
  return useCallback(
    (why: AuthReason, then: () => void) => (signedIn ? then() : ask(why, then)),
    [signedIn, ask],
  );
}

/** Demo account the login sheet signs in (password lives only in the prototype). */
export const DEMO_EMAIL = 'nita@virtualbiz.com';
export const DEMO_PASSWORD = 'Demo@1234';

/** Why the sheet's login failed (message key under shop.login, plus lock seconds). */
export type SheetLoginError =
  | { key: 'noAccount' | 'wrong' | 'generic' | 'network' }
  | { key: 'locked'; seconds: number };

/**
 * Password login from the sheet (`POST /api/auth/login`): any account the full sign-in page
 * accepts. Returns the user, or why it failed.
 */
export async function sheetSignIn(
  email: string,
  password: string,
): Promise<User | SheetLoginError> {
  try {
    const session = await login(email.trim().toLowerCase(), password);
    // The shop shell seeds the demo history once it sees the new user.
    useSessionStore.getState().signIn(session, 'PASSWORD');
    return session.user;
  } catch (e) {
    if (isApiError(e, 'ACCOUNT_LOCKED'))
      return { key: 'locked', seconds: metaNumber(e, 'retryAfter', 30) };
    if (isApiError(e, 'INVALID_CREDENTIALS'))
      return { key: e.meta('reason') === 'NO_ACCOUNT' ? 'noAccount' : 'wrong' };
    return { key: isApiError(e, 'NETWORK_ERROR') ? 'network' : 'generic' };
  }
}
