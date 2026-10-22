'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { WorkspaceSwitcher } from '@/features/account-switcher';
import { cx, Ic, s } from '@/features/seller-shared';
import { useSession } from '@/lib/auth';
import { useRouter } from '@/lib/i18n/navigation';

import shell from './shell.module.css';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { phoneOnly } from '@/components/layout/SideNav';

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Console header: who is signed in and at what level, a quick search that opens the matching
 * list (an order number goes to orders, an email or phone to users, anything else to shops).
 */
export function AdminTopBar() {
  const t = useTranslations('admin.top');
  const { user } = useSession();
  const router = useRouter();
  const [q, setQ] = useState('');
  if (!user) return null;
  const search = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    const to = /^vb-?\d+$/i.test(v)
      ? `/admin/orders?q=${encodeURIComponent(v)}`
      : /@|^0\d{6,}$|^\+?855/.test(v.replace(/\s/g, ''))
        ? `/admin/users?q=${encodeURIComponent(v)}`
        : `/admin/shops?q=${encodeURIComponent(v)}`;
    router.push(to);
    setQ('');
  };
  return (
    <header className={s.top}>
      <div className={cx(s.biz, phoneOnly)}>
        <span className={cx(s.lg, shell.logo)}>
          <Ic name="alert" size={18} />
        </span>
        <div className={shell.brandText}>
          <strong>{t('title')}</strong>
          <span className={s.bizSub}>
            <span className={shell.role}>
              {t(user.platformRole === 'SUPER_ADMIN' ? 'superAdmin' : 'admin')}
            </span>
          </span>
        </div>
      </div>
      <form
        className={s.cmdk}
        role="search"
        onSubmit={search}
        style={{ cursor: 'text', minWidth: 0, flex: '1 1 auto' }}
      >
        <Ic name="search" size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          aria-label={t('searchLabel')}
          style={{
            border: 0,
            background: 'transparent',
            outline: 'none',
            flex: 1,
            minWidth: 0,
            font: 'inherit',
          }}
        />
      </form>
      <LanguageSwitcher compact />
      <WorkspaceSwitcher
        active={{ kind: 'admin' }}
        className={s.me}
        label={t('account', { name: user.name })}
      >
        {initials(user.name)}
      </WorkspaceSwitcher>
    </header>
  );
}
