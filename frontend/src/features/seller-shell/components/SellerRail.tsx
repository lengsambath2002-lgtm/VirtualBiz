'use client';

import { useTranslations } from 'next-intl';

import { cx, Ic, lowVars, s, useDb, type IcName } from '@/features/seller-shared';
import { useScrollMini } from '@/lib/hooks/useScrollMini';
import { Link, usePathname } from '@/lib/i18n/navigation';

import shell from './shell.module.css';

export const NAV: { key: string; href: string; icon: IcName; hideM?: boolean }[] = [
  { key: 'home', href: '/seller', icon: 'home' },
  { key: 'pos', href: '/seller/pos', icon: 'pos' },
  { key: 'orders', href: '/seller/orders', icon: 'orders' },
  { key: 'products', href: '/seller/products', icon: 'box' },
  { key: 'inventory', href: '/seller/inventory', icon: 'stock' },
  { key: 'promotions', href: '/seller/promotions', icon: 'tag', hideM: true },
  { key: 'customers', href: '/seller/customers', icon: 'users', hideM: true },
  { key: 'reviews', href: '/seller/reviews', icon: 'star', hideM: true },
  { key: 'settings', href: '/seller/settings', icon: 'gear' },
];

// Same item styling as the shared glass Rail (src/components/glass/Rail.tsx).
const ITEM =
  'relative grid w-[62px] justify-items-center gap-[3px] rounded-[18px] py-2 text-[10.5px] font-medium text-muted no-underline ' +
  'hover:bg-sunk hover:text-ink max-[860px]:w-auto max-[860px]:flex-1 max-[860px]:rounded-capsule max-[860px]:py-1.5';
const ON = 'bg-glass-strong text-ink shadow-[0_2px_10px_rgba(0,0,0,.08)]';
const BADGE =
  'absolute right-3 top-1 grid h-4 min-w-4 place-items-center rounded-capsule bg-[#FF3B30] px-1 text-[10px] font-bold text-white';

/**
 * Floating glass rail (bottom capsule ≤860px). The shared Rail marks a parent route active for
 * every child (so "/seller" would always be on); the workspace needs exact matching for Home.
 */
export function SellerRail({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations('seller.nav');
  const db = useDb();
  const pathname = usePathname();
  const mini = useScrollMini();
  const badge: Record<string, number> = {
    orders: db.orders.filter((o) => o.status === 'NEW').length,
    inventory: lowVars(db.products).length,
    reviews: db.reviews.filter((r) => !r.reply).length,
  };
  return (
    <nav aria-label={t('label')} data-mini={mini} className={cx('vb-rail', shell.rail)}>
      <span className={cx('vb-rail-hide-m', s.logoMark, shell.logo)} aria-hidden="true">
        B
      </span>
      {NAV.map((n) => {
        const on =
          n.href === '/seller'
            ? pathname === '/seller'
            : pathname === n.href || pathname.startsWith(n.href + '/');
        const b = badge[n.key] ?? 0;
        return (
          <Link
            key={n.key}
            href={n.href}
            aria-current={on ? 'page' : undefined}
            className={cx(ITEM, on && ON, n.hideM && 'vb-rail-hide-m')}
          >
            <Ic name={n.icon} size={22} />
            <span className="vb-rail-label">{t(n.key as 'home')}</span>
            {b > 0 && <span className={BADGE}>{b}</span>}
          </Link>
        );
      })}
      <span className="vb-rail-hide-m flex-1" />
      <button
        type="button"
        className={cx('vb-rail-hide-m', ITEM, 'border-0 bg-transparent')}
        onClick={onLogout}
      >
        <Ic name="logout" size={22} />
        <span>{t('logout')}</span>
      </button>
    </nav>
  );
}
