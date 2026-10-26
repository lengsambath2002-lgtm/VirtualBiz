'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useSession } from '@/lib/auth';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { photoBg } from '@/lib/utils/photo';
import {
  SideNav,
  SideNavBrand,
  sideNavFrame,
  type SideNavSection,
} from '@/components/layout/SideNav';
import { WorkspaceLoading } from '@/components/feedback';

import { k } from '@/features/provider-shared/cx';
import { PIcon, type PIconName } from '@/features/provider-shared/components/Icon';
import { ProviderToast } from '@/features/provider-shared/components/Overlay';
import { pageHref, type ProviderPage } from '@/features/provider-shared/hooks/useActions';
import { useProviderData } from '@/features/provider-shared/queries';
import { StatusBanner } from '@/features/business-status';
import { useData, useUi } from '@/features/provider-shared/store';
import { setCalendarRange } from '@/features/provider-shared/util/time';
import { initials, pending } from '@/features/provider-shared/util/logic';

import { OverlayHost } from './OverlayHost';
import { TopBar } from './TopBar';

/** The workspace's destinations by group; `tab` ones fill the phone's bottom bar. */
const NAV: {
  section: 'main' | 'grow' | 'manage';
  page: ProviderPage | 'activity';
  icon: PIconName;
  tab?: boolean;
}[] = [
  { section: 'main', page: 'home', icon: 'home', tab: true },
  { section: 'main', page: 'calendar', icon: 'cal', tab: true },
  { section: 'main', page: 'sales', icon: 'sales', tab: true },
  { section: 'main', page: 'clients', icon: 'users', tab: true },
  { section: 'main', page: 'services', icon: 'scissors' },
  { section: 'grow', page: 'marketing', icon: 'megaphone' },
  { section: 'manage', page: 'team', icon: 'team' },
  { section: 'manage', page: 'activity', icon: 'activity' },
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
        <WorkspaceLoading />
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
    <div className={k('root')} data-overlay-root>
      <div className={sideNavFrame}>
        <Rail />
        <div className={k('main')}>
          <TopBar />
          <main className={k('page')}>
            <StatusBanner
              businessId={businessId}
              settingsHref="/provider/settings?section=payments"
            />
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
  const tc = useTranslations('common.nav');
  const locale = useLocale();
  const d = useData();
  const confirm = useUi((s) => s.confirm);
  const signOut = useSessionSignOut();
  const b = d.business;
  const badge: Partial<Record<string, number>> = {
    calendar: pending(d).length,
    marketing: d.reviews.filter((r) => !r.reply).length,
  };
  // Each count opens what it counts: the requests to answer, the reviews to reply to.
  const queue: Partial<Record<string, string>> = {
    calendar: '/provider/calendar?requests=1',
    marketing: '/provider/marketing?tab=reviews',
  };
  const sections: SideNavSection[] = (['main', 'grow', 'manage'] as const).map((sec) => ({
    key: sec,
    ...(sec === 'main' ? {} : { title: t(`nav.sections.${sec}`) }),
    items: NAV.filter((n) => n.section === sec).map((n) => ({
      key: n.page,
      href: n.page === 'activity' ? '/provider/activity' : pageHref(n.page),
      label: t(`nav.${n.page}`),
      icon: <PIcon name={n.icon} size={20} />,
      badge: badge[n.page] ?? 0,
      ...(badge[n.page]
        ? {
            badgeHint: t(`nav.hints.${n.page as 'calendar'}`, { n: badge[n.page]! }),
            badgeHref: queue[n.page],
          }
        : {}),
      exact: n.page === 'home',
      tab: !!n.tab,
    })),
  }));
  return (
    <SideNav
      label={t('nav.label')}
      sections={sections}
      brand={(collapsed) => (
        <SideNavBrand
          collapsed={collapsed}
          name={b.name}
          mark={
            <span
              style={{
                backgroundColor: '#ece5fb',
                color: '#5634a0',
                display: 'grid',
                placeItems: 'center',
                ...photoBg(b.logoUrl),
              }}
            >
              {b.logoUrl ? null : initials(b.name)}
            </span>
          }
          sub={
            <>
              <i className={k('dot', !b.online && 'off')} />
              {b.online ? t('shell.onlineOn') : t('shell.onlinePaused')}
            </>
          }
        />
      )}
      footer={[
        {
          key: 'settings',
          href: pageHref('settings'),
          label: t('nav.settings'),
          icon: <PIcon name="gear" size={20} />,
        },
        {
          key: 'explore',
          href: `/${locale}/search`,
          external: true,
          label: tc('explore'),
          icon: <PIcon name="search" size={20} />,
        },
        {
          key: 'logout',
          label: t('nav.logOut'),
          icon: <PIcon name="logout" size={20} />,
          onClick: async () => {
            const ok = await confirm({
              title: t('shell.logoutTitle'),
              body: t('shell.logoutBody'),
              ok: t('shell.logoutOk'),
              danger: true,
            });
            if (ok) signOut();
          },
        },
      ]}
    />
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
