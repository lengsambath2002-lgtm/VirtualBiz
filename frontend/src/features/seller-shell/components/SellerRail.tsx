'use client';

import { useLocale, useTranslations } from 'next-intl';

import { SideNav, SideNavBrand, type SideNavSection } from '@/components/layout/SideNav';
import { cx, Ic, initials, lowVars, s, useDb, type IcName } from '@/features/seller-shared';
import { photoBg } from '@/lib/utils/photo';

type Key =
  | 'home'
  | 'pos'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'promotions'
  | 'reviews'
  | 'team'
  | 'activity';

/** The workspace's destinations by group; `tab` ones fill the phone's bottom bar. */
export const NAV: {
  section: 'main' | 'customers' | 'manage';
  key: Key;
  href: string;
  icon: IcName;
  tab?: boolean;
}[] = [
  { section: 'main', key: 'home', href: '/seller', icon: 'home', tab: true },
  { section: 'main', key: 'pos', href: '/seller/pos', icon: 'pos', tab: true },
  { section: 'main', key: 'orders', href: '/seller/orders', icon: 'orders', tab: true },
  { section: 'main', key: 'products', href: '/seller/products', icon: 'box', tab: true },
  { section: 'main', key: 'inventory', href: '/seller/inventory', icon: 'stock' },
  { section: 'customers', key: 'customers', href: '/seller/customers', icon: 'users' },
  { section: 'customers', key: 'promotions', href: '/seller/promotions', icon: 'tag' },
  { section: 'customers', key: 'reviews', href: '/seller/reviews', icon: 'star' },
  { section: 'manage', key: 'team', href: '/seller/team', icon: 'team' },
  { section: 'manage', key: 'activity', href: '/seller/activity', icon: 'activity' },
];

/** The seller workspace's sidebar (bottom bar and drawer on phones). */
export function SellerRail({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations('seller.nav');
  const tt = useTranslations('seller.top');
  const locale = useLocale();
  const db = useDb();
  const shop = db.shop;
  const badge: Partial<Record<Key, number>> = {
    orders: db.orders.filter((o) => o.status === 'NEW').length,
    inventory: lowVars(db.products).length,
    reviews: db.reviews.filter((r) => !r.reply).length,
  };
  const sections: SideNavSection[] = (['main', 'customers', 'manage'] as const).map((sec) => ({
    key: sec,
    ...(sec === 'main' ? {} : { title: t(`sections.${sec}`) }),
    items: NAV.filter((n) => n.section === sec).map((n) => ({
      key: n.key,
      href: n.href,
      label: t(n.key),
      icon: <Ic name={n.icon} size={20} />,
      badge: badge[n.key] ?? 0,
      exact: n.href === '/seller',
      tab: !!n.tab,
    })),
  }));
  return (
    <SideNav
      label={t('label')}
      sections={sections}
      brand={(collapsed) => (
        <SideNavBrand
          collapsed={collapsed}
          name={shop.name}
          mark={
            <span className={s.lg} style={photoBg(shop.logoUrl)}>
              {shop.logoUrl ? null : initials(shop.name.replace(/\bStore\b/i, ''))}
            </span>
          }
          sub={
            <>
              <i className={cx(s.dot, !shop.online && s.dotOff)} />
              {shop.online ? tt('open') : tt('paused')}
            </>
          }
        />
      )}
      footer={[
        {
          key: 'settings',
          href: '/seller/settings',
          label: t('settings'),
          icon: <Ic name="gear" size={20} />,
        },
        {
          key: 'view',
          href: `/${locale}/shop/${shop.id}`,
          external: true,
          label: t('viewShop'),
          icon: <Ic name="store" size={20} />,
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
