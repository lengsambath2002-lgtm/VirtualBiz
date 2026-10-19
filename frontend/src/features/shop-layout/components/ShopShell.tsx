'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { useLiveStream } from '@/lib/api/useLiveStream';
import { useSession } from '@/lib/auth';
import { useScrollMini } from '@/lib/hooks/useScrollMini';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic, type IcName } from '@/features/shop-shared/components/Ic';
import { AddressSheet, LoginSheet, ToastHost } from '@/features/shop-shared/components/sheets';
import { paymentKey } from '@/features/khqr-payment/components/KhqrModal';
import { notificationsKey } from '@/features/notification/queries';
import { useCartSync } from '@/features/shop-cart/sync';
import { ReviewSheet } from '@/features/shop-review';
import { orderKey, ordersKey } from '@/features/shop-order-tracking/queries';
import { bookingsKey } from '@/features/shop-service-booking/queries';
import { ErrorView } from '@/components/feedback';
import { refreshCatalog, useCatalog } from '@/features/shop-shared/hooks';
import s from '@/features/shop-shared/shop.module.css';
import { useShopStore } from '@/features/shop-shared/store';
import { searchHref } from '@/features/shop-search/util/searchParams';

import { ShopHeader } from './ShopHeader';

function ShopFooter() {
  const t = useTranslations('shop.footer');
  const tc = useTranslations('common');
  const pays = ['khqr', 'abaPay', 'acleda', 'wing', 'visa', 'mastercard', 'cash'] as const;
  return (
    <footer className={s.footer}>
      <div className={cn(s.wrap, s.ft)}>
        <div>
          <Link className={s.logo} href="/home">
            <span className={s.logoMark}>B</span>
            <span>
              Virtual<b>Biz</b>
            </span>
          </Link>
          <p className={cn(s.muted, s.ftAbout)}>{t('about')}</p>
          <div className={s.pays}>
            {pays.map((p) => (
              <span key={p}>{tc(`payments.${p}`)}</span>
            ))}
          </div>
        </div>
        <div>
          <h4>{t('shop')}</h4>
          <Link href="/search">{t('allProducts')}</Link>
          <Link href="/deals">{t('dealsEvents')}</Link>
          <Link href={searchHref({ type: 'service' })}>{t('bookService')}</Link>
        </div>
        <div>
          <h4>{t('help')}</h4>
          <Link href="/help">{t('helpCentre')}</Link>
          <Link href="/help">{t('deliveryReturns')}</Link>
          <Link href="/help">{t('contact', { phone: '023 900 100' })}</Link>
        </div>
        <div>
          <h4>{t('business')}</h4>
          <Link href="/help">{t('sell')}</Link>
          <Link href="/help">{t('takeBookings')}</Link>
          <Link href="/help">{t('terms')}</Link>
          <Link href="/help">{t('privacy')}</Link>
        </div>
      </div>
      <div className={cn(s.wrap, s.ftB)}>
        <span>{t('copyright')}</span>
        <span>{tc('rateNote')}</span>
      </div>
    </footer>
  );
}

const TABS: [string, string, IcName][] = [
  ['home', '/home', 'home'],
  ['explore', '/search', 'search'],
  ['deals', '/deals', 'tag'],
  ['cart', '/cart', 'cart'],
  ['account', '/account/orders', 'user'],
];
const TAB_ROOT: Record<string, string> = {
  home: '/home',
  explore: '/search',
  deals: '/deals',
  cart: '/cart',
  account: '/account',
};

function ShopTabBar() {
  const t = useTranslations('shop.tabs');
  const pathname = usePathname();
  const mini = useScrollMini();
  const cartN = useShopStore((st) => st.cart.reduce((a, c) => a + c.qty, 0));
  return (
    <nav aria-label={t('label')} data-mini={mini} className="vb-tabbar">
      {TABS.map(([k, href, ic]) => {
        const root = TAB_ROOT[k] ?? href;
        const on = pathname === root || pathname.startsWith(root + '/');
        return (
          <Link
            key={k}
            href={href}
            className={cn(s.tabA, on && s.on)}
            aria-current={on ? 'page' : undefined}
          >
            <Ic name={ic} size={22} />
            {k === 'cart' && cartN > 0 && <span className={s.badge}>{cartN}</span>}
            <span className="vb-tab-label">{t(k as 'home')}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Rehydrates the persisted shop state and the session once on the client. */
function useShopReady() {
  const session = useSession();
  const [hydrated, setHydrated] = useState(() => useShopStore.persist?.hasHydrated() ?? false);
  useEffect(() => {
    if (useShopStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useShopStore.persist.onFinishHydration(() => setHydrated(true));
    void useShopStore.persist.rehydrate();
    return unsub;
  }, []);
  return hydrated && session.ready;
}

/**
 * The signed-in customer's live updates (docs/api/phase3-orders-checkout.md § Live updates):
 * order changes refresh the order pages and the stock they moved, booking changes the
 * bookings (and free times), inbox entries the bell,
 * payment confirmations the KHQR sheet. A (re)connect refreshes all of them.
 */
function useCustomerStream() {
  const qc = useQueryClient();
  const { user, signedIn } = useSession();
  useLiveStream('me', {
    enabled: signedIn,
    onEvent: (e) => {
      const uid = user?.id;
      if (e.name === 'order' || e.name === 'open') {
        void qc.invalidateQueries({
          queryKey: e.data.number ? orderKey(uid, e.data.number) : ordersKey(uid),
        });
        void qc.invalidateQueries({ queryKey: ordersKey(uid), exact: true });
        if (e.name === 'open' || ['CANCELLED', 'RETURNED'].includes(e.data.status ?? ''))
          void refreshCatalog(qc);
      }
      if (e.name === 'appointment' || e.name === 'open') {
        void qc.invalidateQueries({ queryKey: bookingsKey(uid) });
        void qc.invalidateQueries({ queryKey: ['availability'] });
      }
      if (e.name === 'notification' || e.name === 'open')
        void qc.invalidateQueries({ queryKey: notificationsKey(uid) });
      if (e.name === 'payment' && e.data.id)
        void qc.invalidateQueries({ queryKey: paymentKey(e.data.id) });
    },
  });
}

/** Customer marketplace frame: two-row sticky header, footer, phone tab bar, sheets, toast. */
export function ShopShell({ children }: { children: ReactNode }) {
  const ready = useShopReady();
  const catalog = useCatalog();
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const loaded = ready && !!catalog.data;
  useCartSync(loaded);
  useCustomerStream();
  return (
    <div className={s.root}>
      {loaded ? (
        <>
          <Suspense>
            <ShopHeader />
          </Suspense>
          <main className={cn(s.wrap, s.main)} id="main">
            {children}
          </main>
          <ShopFooter />
          <ShopTabBar />
          <LoginSheet />
          <AddressSheet />
          <ReviewSheet />
          <ToastHost />
        </>
      ) : catalog.isError && !catalog.data ? (
        // The marketplace could not load (offline, or the API is down): say so, offer a retry.
        <ErrorView error={catalog.error} retry={() => void catalog.refetch()} home={null} />
      ) : (
        <div className={s.hdr} style={{ height: 113 }} />
      )}
    </div>
  );
}
