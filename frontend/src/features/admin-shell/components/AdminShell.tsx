'use client';

import { useTranslations } from 'next-intl';
import { Suspense, useEffect, type ReactNode } from 'react';

import { StaffGate } from '@/features/admin-security';
import { ConfirmDialog, cx, s, ToastHost, useUi } from '@/features/seller-shared';
import { useSession } from '@/lib/auth';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';

import { AdminRail } from './AdminRail';
import { AdminTopBar } from './AdminTopBar';
import shell from './shell.module.css';
import { sideNavFrame } from '@/components/layout/SideNav';

/** The one overlay the console uses: the confirm / reason dialog. */
function Overlay() {
  const o = useUi((u) => u.overlay);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useUi.getState().close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (o?.kind !== 'confirm') return null;
  return <ConfirmDialog key={o.spec.title} spec={o.spec} resolve={o.resolve} />;
}

function Console({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const session = useSession();
  const router = useRouter();
  const logout = async () => {
    const ok = await useUi.getState().confirm({
      title: t('logout.title'),
      body: t('logout.body'),
      ok: t('logout.ok'),
      danger: true,
    });
    if (!ok) return;
    void session.signOut();
    router.push('/sign-in');
  };
  return (
    <>
      <div className={sideNavFrame}>
        <AdminRail onLogout={() => void logout()} />
        <div className={s.main}>
          <AdminTopBar />
          <main className={s.page}>
            <Suspense>{children}</Suspense>
          </main>
        </div>
      </div>
      <Overlay />
      <ToastHost />
    </>
  );
}

function Denied() {
  const t = useTranslations('admin.denied');
  return (
    <div className={shell.denied}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 650 }}>{t('title')}</h1>
        <p className={s.muted}>{t('body')}</p>
        <Link className={cx(s.btn, s.btnPrimary)} href="/home">
          {t('home')}
        </Link>
      </div>
    </div>
  );
}

/**
 * The super-admin console frame (docs/api/phase7-admin.md): signed-in VirtualBiz staff only, once
 * their session passed the staff gate (docs/api/phase9-staff-security.md). Anyone else signed in
 * sees "no access"; signed-out visitors go to sign-in first.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session.ready && !session.user)
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [session.ready, session.user, pathname, router]);
  return (
    <div className={s.root}>
      {!session.ready || !session.user ? (
        <div className={shell.loading} aria-busy="true" />
      ) : session.user.platformRole ? (
        <StaffGate>
          <Console>{children}</Console>
        </StaffGate>
      ) : !session.validated ? (
        // A user saved before they became staff: wait for the server's copy before saying no.
        <div className={shell.loading} aria-busy="true" />
      ) : (
        <Denied />
      )}
    </div>
  );
}
