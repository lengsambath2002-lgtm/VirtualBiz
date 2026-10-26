'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/lib/auth';
import type { BusinessType } from '@/lib/domain';
import { Link, useRouter } from '@/lib/i18n/navigation';
import type { MyBusiness } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { setActiveBusiness } from '@/lib/workspace';
import { photoBg } from '@/lib/utils/photo';

import { useMyBusinesses, WORKSPACE_HREF } from '../hooks/useMyBusinesses';
import s from './switcher.module.css';

const initials = (n: string) =>
  (n || '?')
    .replace(/\b(store|shop|salon)\b/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Which profile is active: the personal (customer) account, one business, or the admin console. */
export type ActiveProfile =
  | { kind: 'personal' }
  | { kind: 'business'; id: string }
  | { kind: 'admin' };

const TYPE_LABEL: Record<BusinessType, 'productShop' | 'serviceProvider'> = {
  PRODUCT: 'productShop',
  SERVICE: 'serviceProvider',
};

/** Square business logo (initials on the type's tint) with a small type badge. */
/** More shops than this get a search and a scrolling list. */
const MANY = 6;

export function BusinessLogo({
  b,
  size = 40,
}: {
  b: Pick<MyBusiness, 'name' | 'type' | 'logoUrl'>;
  size?: number;
}) {
  return (
    <span
      className={cn(s.logo, b.type === 'SERVICE' ? s.svc : s.prd)}
      style={{ width: size, height: size, fontSize: size * 0.36, ...photoBg(b.logoUrl) }}
    >
      {b.logoUrl ? null : initials(b.name)}
      <span className={s.typeBadge}>
        <Icon name={b.type === 'SERVICE' ? 'scissors' : 'store'} size={11} strokeWidth={2.2} />
      </span>
    </span>
  );
}

/**
 * Facebook-style profile switcher: the personal account first, then every business the user
 * can manage (each a "page" with its own workspace), then "Create a new business". Switching
 * shows a short "Switching to …" screen, then opens that profile.
 */
export function ProfileSwitcher({
  active,
  onNavigate,
}: {
  active: ActiveProfile;
  /** Called before navigating (close the surrounding menu). */
  onNavigate?: () => void;
}) {
  const t = useTranslations('common.switcher');
  const router = useRouter();
  const locale = useLocale();
  const { user } = useSession();
  const { data: businesses = [], isLoading } = useMyBusinesses();
  const [switching, setSwitching] = useState<{ name: string; logo: React.ReactNode } | null>(null);
  // Many shops: find one by name, in a list that scrolls instead of filling the screen.
  const [find, setFind] = useState('');
  if (!user) return null;

  const go = (
    to: { kind: 'personal' } | { kind: 'business'; b: MyBusiness },
    name: string,
    logo: React.ReactNode,
  ) => {
    setSwitching({ name, logo });
    // Long enough to read "Switching to …"; the next page replaces this screen.
    setTimeout(() => {
      if (to.kind === 'personal') return router.push('/home');
      // A full load so the workspace opens on the chosen business (each keeps its own data).
      setActiveBusiness(to.b.type, to.b.id);
      window.location.assign(`/${locale}${WORKSPACE_HREF[to.b.type]}`);
    }, 650);
  };

  const isActive = (p: ActiveProfile) =>
    p.kind === active.kind &&
    (p.kind !== 'business' || (active.kind === 'business' && p.id === active.id));

  const personalLogo = (
    <span className={cn(s.logo, s.person)} style={photoBg(user.avatarUrl)}>
      {user.avatarUrl ? null : initials(user.name)}
    </span>
  );

  return (
    <div className={s.list} role="group" aria-label={t('title')}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={isActive({ kind: 'personal' })}
        className={s.row}
        onClick={() =>
          isActive({ kind: 'personal' })
            ? onNavigate?.()
            : go({ kind: 'personal' }, user.name, personalLogo)
        }
      >
        {personalLogo}
        <span className={s.text}>
          <strong>{user.name}</strong>
          <small>{t('personal')}</small>
        </span>
        {isActive({ kind: 'personal' }) && <Icon name="check" size={18} className={s.tick} />}
      </button>

      {user.platformRole && (
        <Link
          href="/admin"
          role="menuitemradio"
          aria-checked={isActive({ kind: 'admin' })}
          className={s.row}
          onClick={onNavigate}
        >
          <span className={cn(s.logo, s.admin)}>
            <Icon name="shield" size={20} />
          </span>
          <span className={s.text}>
            <strong>{t('admin')}</strong>
            <small>{t(user.platformRole === 'SUPER_ADMIN' ? 'superAdmin' : 'staff')}</small>
          </span>
          {isActive({ kind: 'admin' }) && <Icon name="check" size={18} className={s.tick} />}
        </Link>
      )}

      <div className={s.label}>{t('yourShops')}</div>
      {isLoading ? (
        <div className={s.skel} aria-hidden="true" />
      ) : businesses.length ? (
        <>
          {businesses.length > MANY && (
            <input
              type="search"
              className={s.find}
              value={find}
              placeholder={t('find')}
              aria-label={t('find')}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          )}
          <div className={cn(businesses.length > MANY && s.scroll)}>
            {businesses
              .filter(
                (b) => !find.trim() || b.name.toLowerCase().includes(find.trim().toLowerCase()),
              )
              .map((b) => {
                const on = isActive({ kind: 'business', id: b.id });
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    className={s.row}
                    onClick={() =>
                      on
                        ? onNavigate?.()
                        : go({ kind: 'business', b }, b.name, <BusinessLogo b={b} size={64} />)
                    }
                  >
                    <BusinessLogo b={b} />
                    <span className={s.text}>
                      <strong>{b.name}</strong>
                      <small>
                        {t(TYPE_LABEL[b.type])}
                        <span className={cn(s.tag, b.role === 'OWNER' && s.tagOwner)}>
                          {t(`roles.${b.role}`)}
                        </span>
                      </small>
                    </span>
                    {on && <Icon name="check" size={18} className={s.tick} />}
                  </button>
                );
              })}
          </div>
        </>
      ) : null}

      <Link
        href="/create-business"
        role="menuitem"
        className={cn(s.row, s.create)}
        onClick={onNavigate}
      >
        <span className={cn(s.logo, s.plus)}>
          <Icon name="plus" size={18} />
        </span>
        <span className={s.text}>
          <strong>{t('create')}</strong>
        </span>
      </Link>

      {switching &&
        createPortal(
          <div className={s.switching} role="status" aria-live="polite">
            <div className={s.switchingIn}>
              <span className={s.bigLogo}>{switching.logo}</span>
              <strong>{t('switching', { name: switching.name })}</strong>
              <span className={s.spinner} aria-hidden="true" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
