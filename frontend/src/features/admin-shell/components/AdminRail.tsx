'use client';

import { useLocale, useTranslations } from 'next-intl';

import { SideNav, SideNavBrand, type SideNavSection } from '@/components/layout/SideNav';
import { useOverview } from '@/features/admin-shared/api';
import { Ic, type IcName } from '@/features/seller-shared';
import { useSession } from '@/lib/auth';
import { rangeOf } from '@/lib/utils/dateRange';

import shell from './shell.module.css';

type Key = 'overview' | 'shops' | 'users' | 'orders' | 'reviews' | 'payouts' | 'promos' | 'audit';

/** The console's destinations by group; `tab` ones fill the phone's bottom bar. */
export const ADMIN_NAV: {
  section: 'main' | 'marketplace' | 'money' | 'platform';
  key: Key;
  href: string;
  icon: IcName;
  tab?: boolean;
}[] = [
  { section: 'main', key: 'overview', href: '/admin', icon: 'home', tab: true },
  { section: 'marketplace', key: 'shops', href: '/admin/shops', icon: 'store', tab: true },
  { section: 'marketplace', key: 'users', href: '/admin/users', icon: 'users' },
  { section: 'marketplace', key: 'orders', href: '/admin/orders', icon: 'orders', tab: true },
  { section: 'marketplace', key: 'reviews', href: '/admin/reviews', icon: 'star' },
  { section: 'money', key: 'payouts', href: '/admin/payouts', icon: 'receipt', tab: true },
  { section: 'money', key: 'promos', href: '/admin/promos', icon: 'tag' },
  { section: 'platform', key: 'audit', href: '/admin/audit', icon: 'alert' },
];

/** The console's sidebar; badges show the work queues. */
export function AdminRail({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations('admin.nav');
  const tc = useTranslations('common.nav');
  const tt = useTranslations('admin.top');
  const locale = useLocale();
  const { user } = useSession();
  const q = useOverview().data?.queues;
  const badge: Partial<Record<Key, number>> = {
    shops: q?.pendingVerifications ?? 0,
    orders: q?.stuckOrders ?? 0,
    reviews: q?.lowReviews7d ?? 0,
    payouts: q?.payoutShops ?? 0,
  };
  // Each count opens the list filtered to exactly what it counts.
  const queue: Partial<Record<Key, string>> = {
    shops: '/admin/shops?verification=PENDING',
    orders: '/admin/orders?status=stuck',
    reviews: `/admin/reviews?status=low&${new URLSearchParams(rangeOf('last7'))}`,
    payouts: '/admin/payouts?due=payable',
  };
  const sections: SideNavSection[] = (['main', 'marketplace', 'money', 'platform'] as const).map(
    (sec) => ({
      key: sec,
      ...(sec === 'main' ? {} : { title: t(`sections.${sec}`) }),
      items: ADMIN_NAV.filter((n) => n.section === sec).map((n) => ({
        key: n.key,
        href: n.href,
        label: t(n.key),
        icon: <Ic name={n.icon} size={20} />,
        badge: badge[n.key] ?? 0,
        ...(badge[n.key]
          ? {
              badgeHint: t(`hints.${n.key as 'shops'}`, { n: badge[n.key]! }),
              badgeHref: queue[n.key],
            }
          : {}),
        exact: n.href === '/admin',
        tab: !!n.tab,
      })),
    }),
  );
  return (
    <SideNav
      label={t('label')}
      sections={sections}
      brand={(collapsed) => (
        <SideNavBrand
          collapsed={collapsed}
          name={tt('title')}
          mark={
            <span className={shell.mark} aria-hidden>
              B
            </span>
          }
          sub={
            <span className={shell.role}>
              {tt(user?.platformRole === 'SUPER_ADMIN' ? 'superAdmin' : 'admin')}
            </span>
          }
        />
      )}
      footer={[
        {
          key: 'settings',
          href: '/admin/settings',
          label: t('settings'),
          icon: <Ic name="gear" size={20} />,
        },
        {
          key: 'explore',
          href: `/${locale}/search`,
          external: true,
          label: tc('explore'),
          icon: <Ic name="search" size={20} />,
        },
        {
          key: 'logout',
          label: t('logout'),
          icon: <Ic name="logout" size={20} />,
          onClick: onLogout,
        },
      ]}
    />
  );
}
