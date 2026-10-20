'use client';

import { useTranslations } from 'next-intl';

import { useOverview } from '@/features/admin-shared/api';
import { cx, Ic, s, type IcName } from '@/features/seller-shared';
import { useScrollMini } from '@/lib/hooks/useScrollMini';
import { Link, usePathname } from '@/lib/i18n/navigation';

import shell from './shell.module.css';

export const ADMIN_NAV: { key: string; href: string; icon: IcName; hideM?: boolean }[] = [
  { key: 'overview', href: '/admin', icon: 'home' },
  { key: 'shops', href: '/admin/shops', icon: 'store' },
  { key: 'users', href: '/admin/users', icon: 'users' },
  { key: 'orders', href: '/admin/orders', icon: 'orders' },
  { key: 'reviews', href: '/admin/reviews', icon: 'star', hideM: true },
  { key: 'promos', href: '/admin/promos', icon: 'tag', hideM: true },
  { key: 'payouts', href: '/admin/payouts', icon: 'receipt' },
  { key: 'audit', href: '/admin/audit', icon: 'alert', hideM: true },
  { key: 'settings', href: '/admin/settings', icon: 'gear', hideM: true },
];

// Same item styling as the seller rail (SellerRail.tsx).
const ITEM =
  'relative grid w-[62px] justify-items-center gap-[3px] rounded-[18px] py-2 text-[10.5px] font-medium text-muted no-underline ' +
  'hover:bg-sunk hover:text-ink max-[860px]:w-auto max-[860px]:flex-1 max-[860px]:rounded-capsule max-[860px]:py-1.5';
const ON = 'bg-glass-strong text-ink shadow-[0_2px_10px_rgba(0,0,0,.08)]';
const BADGE =
  'absolute right-3 top-1 grid h-4 min-w-4 place-items-center rounded-capsule bg-[#FF3B30] px-1 text-[10px] font-bold text-white';

/** The console's floating rail; badges show the work queues. */
export function AdminRail({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const mini = useScrollMini();
  const q = useOverview().data?.queues;
  const badge: Record<string, number> = {
    shops: q?.pendingVerifications ?? 0,
    orders: q?.stuckOrders ?? 0,
    reviews: q?.lowReviews7d ?? 0,
    payouts: q?.payoutShops ?? 0,
  };
  return (
    <nav aria-label={t('label')} data-mini={mini} className={cx('vb-rail', shell.rail)}>
      <span className={cx('vb-rail-hide-m', s.logoMark, shell.logo)} aria-hidden="true">
        B
      </span>
      {ADMIN_NAV.map((n) => {
        const on =
          n.href === '/admin'
            ? pathname === '/admin'
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
            <span className="vb-rail-label">{t(n.key as 'overview')}</span>
            {b > 0 && <span className={BADGE}>{b > 99 ? '99+' : b}</span>}
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
