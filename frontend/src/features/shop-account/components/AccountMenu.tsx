'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ProfileSwitcher } from '@/features/account-switcher';
import { Ic, type IcName } from '@/features/shop-shared/components/Ic';
import { initials } from '@/features/shop-shared/rules';
import { useShopUi } from '@/features/shop-shared/store';
import { useSession } from '@/lib/auth';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { photoBg } from '@/lib/utils/photo';

import type { AccountTab } from '../types';
import a from './account.module.css';

export const ACCOUNT_ICONS: Record<AccountTab, IcName> = {
  overview: 'home',
  orders: 'list',
  bookings: 'calendar',
  saved: 'heart',
  addresses: 'pin',
  profile: 'user',
  settings: 'gear',
};

/**
 * Header account menu: My profile, My settings, Switch to shop (product seller or service
 * provider workspace), Help centre, Log out.
 */
export function AccountMenu({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations('shop.account');
  const { user } = useSession();
  const close = useShopUi((u) => u.setMenu);
  const [shops, setShops] = useState(false);
  if (!user) return null;
  const done = () => close(null);
  const link = (href: string, icon: IcName, label: string, hint?: string) => (
    <Link role="menuitem" className={cn(a.item, hint && a.sellRow)} href={href} onClick={done}>
      <Ic name={icon} size={18} />
      {hint ? (
        <span>
          {label}
          <small>{hint}</small>
        </span>
      ) : (
        label
      )}
    </Link>
  );
  return (
    <div className={a.menu} role="menu" aria-label={t('title')} data-menu-pop="">
      <div className={a.menuH}>
        <span className={a.av} style={photoBg(user.avatarUrl)}>
          {user.avatarUrl ? null : initials(user.name)}
        </span>
        <div>
          <strong>{user.name}</strong>
          <span>{user.email ?? user.phone}</span>
        </div>
      </div>
      {shops ? (
        <div className={a.menuB}>
          <button
            type="button"
            className={cn(a.item, a.menuBack)}
            onClick={() => setShops(false)}
            aria-label={t('back')}
          >
            <Ic name="right" size={16} style={{ rotate: '180deg' }} />
            {t('switchShop')}
          </button>
          <ProfileSwitcher active={{ kind: 'personal' }} onNavigate={done} />
        </div>
      ) : (
        <>
          <div className={a.menuB}>
            {link('/account/profile', 'user', t('tabs.profile'))}
            {link('/account/settings', 'gear', t('tabs.settings'))}
            <button
              role="menuitem"
              type="button"
              className={a.item}
              aria-haspopup="menu"
              onClick={() => setShops(true)}
            >
              <Ic name="swap" size={18} />
              {t('switchShop')}
              <Ic name="right" size={16} className={a.chev} />
            </button>
            {user.platformRole && link('/admin', 'shield', t('adminConsole'))}
            {link('/help', 'help', t('help'))}
          </div>
          <div className={a.menuB}>
            <button
              role="menuitem"
              type="button"
              className={cn(a.item, a.danger)}
              onClick={onLogout}
            >
              <Ic name="logout" size={18} />
              {t('logout')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
