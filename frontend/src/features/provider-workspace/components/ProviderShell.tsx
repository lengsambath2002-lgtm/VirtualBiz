'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useSession } from '@/lib/auth';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { useScrollMini } from '@/lib/hooks/useScrollMini';

import { k } from '@/features/provider-shared/cx';
import { PIcon, type PIconName } from '@/features/provider-shared/components/Icon';
import { ProviderToast } from '@/features/provider-shared/components/Overlay';
import { pageHref, type ProviderPage } from '@/features/provider-shared/hooks/useActions';
import { useProviderData } from '@/features/provider-shared/queries';
import { StatusBanner } from '@/features/business-status';
import { useData, useUi } from '@/features/provider-shared/store';
import { setCalendarRange } from '@/features/provider-shared/util/time';
import { pending } from '@/features/provider-shared/util/logic';

import { OverlayHost } from './OverlayHost';
import { TopBar } from './TopBar';

const NAV: [ProviderPage, PIconName, boolean][] = [
  ['home', 'home', false],
  ['calendar', 'cal', false],
  ['sales', 'sales', false],
  ['clients', 'users', false],
  ['services', 'scissors', false],
  ['team', 'team', true],
  ['marketing', 'megaphone', true],
  ['settings', 'gear', false],
];

const OPENED_KEY = 'vb-provider-opened';

/**
 * Provider workspace chrome (prototype `.app`): floating glass rail, translucent top bar, page,
 * the single overlay and the toast. Requires sign-in; loads the workspace from the API.
 */
export function ProviderShell({ children }: { children: ReactNode }) {
  const t = useTranslations('provider');
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { ready, error, refetch } = useProviderData();
  const signedIn = session.ready && !!session.user;

  // Sign-in gate.
  useEffect(() => {
    if (session.ready && !session.user) {
      const q = search.toString();
      router.replace(`/sign-in?next=${encodeURIComponent(pathname + (q ? `?${q}` : ''))}`);
    }
  }, [session.ready, session.user, pathname, search, router]);

  // The prototype opens on the calendar: the first visit to /provider in a tab lands there.
  useEffect(() => {
    if (!signedIn) return;
    let opened = true;
    try {
      opened = sessionStorage.getItem(OPENED_KEY) === '1';
      sessionStorage.setItem(OPENED_KEY, '1');
    } catch {
      /* storage blocked: show the page asked for */
    }
    if (!opened && pathname === '/provider') router.replace('/provider/calendar');
    // Only on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  if (signedIn && !ready && error) {
    return (
      <div className={k('root')}>
        <div className={k('empty')} role="alert" style={{ margin: 'auto' }}>
          <strong>{t('shell.loadFailed')}</strong>
          <button type="button" className={k('btn btn-primary')} onClick={refetch}>
            {t('shell.retry')}
          </button>
        </div>
      </div>
    );
  }
  if (!signedIn || !ready) {
    return (
      <div className={k('root')}>
        <p className={k('srOnly')} role="status">
          {t('shell.loading')}
        </p>
      </div>
    );
  }
  return <Workspace>{children}</Workspace>;
}

function Workspace({ children }: { children: ReactNode }) {
  const close = useUi((s) => s.close);
  const data = useData();
  const businessId = data.business.id;
  // The calendar spans the shop's opening hours and staff shifts (set before pages render).
  setCalendarRange(
    data.business.hours,
    data.staff.filter((m) => m.active).map((m) => m.shifts),
  );
  // Escape closes the overlay, else an open menu (prototype keydown handler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const ui = useUi.getState();
      if (ui.overlay) {
        if (ui.overlay.t !== 'palette') close();
      } else if (ui.menu) ui.set({ menu: null });
    };
    const onClick = (e: MouseEvent) => {
      const ui = useUi.getState();
      const el = e.target as HTMLElement;
      if (ui.menu && !el.closest('[data-menu]')) ui.set({ menu: null });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [close]);

  return (
    <div className={k('root')}>
      <div className={k('app')}>
        <Rail />
        <div className={k('main')}>
          <TopBar />
          <main className={k('page')}>
            <StatusBanner businessId={businessId} settingsHref="/provider/settings" />
            {children}
          </main>
        </div>
      </div>
      <OverlayHost />
      <ProviderToast />
    </div>
  );
}

function Rail() {
  const t = useTranslations('provider');
  const d = useData();
  const pathname = usePathname();
  const mini = useScrollMini();
  const confirm = useUi((s) => s.confirm);
  const signOut = useSessionSignOut();
  const nReq = pending(d).length;
  const unrep = d.reviews.filter((r) => !r.reply).length;

  return (
    <nav className={k('rail', mini && 'mini')} aria-label={t('nav.label')}>
      <span className={k('logo-mark')} aria-hidden="true">
        B
      </span>
      {NAV.map(([p, ic, hideM]) => {
        const href = pageHref(p);
        const on = pathname === href;
        const badge = p === 'calendar' ? nReq : p === 'marketing' ? unrep : 0;
        return (
          <RailLink key={p} href={href} on={on} hideM={hideM}>
            <PIcon name={ic} size={22} />
            <span>{t(`nav.${p}`)}</span>
            {badge > 0 && <span className={k('dotc')}>{badge}</span>}
          </RailLink>
        );
      })}
      <span className={k('sp')} />
      <button
        type="button"
        className={k('hide-m')}
        onClick={async () => {
          const ok = await confirm({
            title: t('shell.logoutTitle'),
            body: t('shell.logoutBody'),
            ok: t('shell.logoutOk'),
            danger: true,
          });
          if (ok) signOut();
        }}
      >
        <PIcon name="logout" size={22} />
        <span>{t('nav.logOut')}</span>
      </button>
    </nav>
  );
}

function RailLink({
  href,
  on,
  hideM,
  children,
}: {
  href: string;
  on: boolean;
  hideM: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={k(on && 'on', hideM && 'hide-m')}
      aria-current={on ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}

function useSessionSignOut() {
  const { signOut } = useSession();
  const router = useRouter();
  return () => {
    void signOut();
    router.replace('/sign-in');
  };
}
