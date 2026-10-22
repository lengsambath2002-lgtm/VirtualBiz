'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { ErrorView, WorkspaceLoading } from '@/components/feedback';
import { sideNavFrame } from '@/components/layout/SideNav';
import { StatusBanner } from '@/features/business-status';
import { usePaletteHotkey } from '@/features/command-palette';
import {
  cx,
  s,
  ToastHost,
  useGo,
  useSellerBootstrap,
  useSellerStore,
  useUi,
} from '@/features/seller-shared';
import { useLiveStream } from '@/lib/api/useLiveStream';
import { useSession } from '@/lib/auth';
import { usePathname, useRouter } from '@/lib/i18n/navigation';

import { OverlayHost } from './OverlayHost';
import { SellerRail } from './SellerRail';
import { TopBar } from './TopBar';

/** Global workspace behaviour: Esc, Ctrl+K, 1-hour auto-cancel, offline sync, leave guard. */
function useWorkspaceEffects() {
  const t = useTranslations('seller');
  const locale = useLocale();
  const go = useGo();
  const editorDirty = useUi((u) => u.editorDirty);

  usePaletteHotkey(() => useUi.getState().open({ kind: 'palette' }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const ui = useUi.getState();
      if (ui.overlay) ui.close();
      else if (ui.menu) ui.setMenu(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The shop's live stream: orders and the inbox, the register (another device's sales and
  // shifts) and stock. A (re)connect reloads everything that may have changed meanwhile.
  const businessId = useSellerStore((st) => st.db?.shop.id);
  useLiveStream('business', {
    enabled: !!businessId,
    ...(businessId ? { businessId } : {}),
    onEvent: (e) => {
      const st = useSellerStore.getState();
      if (e.name === 'order' || e.name === 'notification' || e.name === 'open')
        void st.resyncOrders();
      if (e.name === 'sale' || e.name === 'shift' || e.name === 'open') void st.resyncExtras();
      if (e.name === 'order' || e.name === 'sale' || e.name === 'open') void st.resync();
    },
  });

  // A slow fallback for missed events (e.g. orders the API auto-cancels after 1 hour).
  useEffect(() => {
    const run = () => void useSellerStore.getState().resyncOrders();
    const id = setInterval(run, 60_000);
    return () => clearInterval(id);
  }, []);

  // Sales not yet confirmed are sent on open (quietly: usually just an interrupted send) and
  // when the connection comes back (with a toast: they were rung up offline).
  useEffect(() => {
    const flush = (announce: boolean) =>
      void useSellerStore
        .getState()
        .flushPending()
        .then((n) => announce && n && useUi.getState().showToast(t('pos.synced', { n })));
    const back = () => flush(true);
    if (navigator.onLine) flush(false);
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [t]);

  // Leave guard for the product editor: in-app links and the browser Back button.
  useEffect(() => {
    if (!editorDirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!a || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      e.preventDefault();
      e.stopPropagation();
      const path = url.pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/';
      void go(path + url.search);
    };
    history.pushState(history.state, '', location.href);
    const onPop = (e: PopStateEvent) => {
      if (!useUi.getState().editorDirty) return;
      e.stopImmediatePropagation();
      void useUi
        .getState()
        .confirm({
          title: t('editor.leaveTitle'),
          body: t('editor.leaveBody'),
          ok: t('editor.leaveOk'),
          danger: true,
        })
        .then((ok) => {
          if (ok) {
            useUi.getState().setEditorDirty(false);
            history.back();
          } else history.pushState(history.state, '', location.href);
        });
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop, true);
    };
  }, [editorDirty, go, locale, t]);
}

function Workspace({ children }: { children: ReactNode }) {
  const t = useTranslations('seller');
  const businessId = useSellerStore((st) => st.db?.shop.id);
  const session = useSession();
  const router = useRouter();
  useWorkspaceEffects();

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
        <SellerRail onLogout={() => void logout()} />
        <div className={s.main}>
          <TopBar />
          <main className={s.page}>
            <StatusBanner businessId={businessId} settingsHref="/seller/settings" />
            {children}
          </main>
        </div>
      </div>
      <OverlayHost />
      <ToastHost />
    </>
  );
}

/**
 * Seller workspace frame: requires sign-in, loads the shop state, then renders the floating
 * rail, the top bar, the page, and the overlay/toast layer.
 */
export function SellerShell({ children, fontClass }: { children: ReactNode; fontClass?: string }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { ready, error } = useSellerBootstrap();
  const qc = useQueryClient();
  const t = useTranslations('common.feedback');

  useEffect(() => {
    if (session.ready && !session.user)
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [session.ready, session.user, pathname, router]);

  const show = ready && session.ready && !!session.user;
  return (
    <div className={cx(s.root, fontClass)} data-overlay-root>
      {show ? (
        <Workspace>{children}</Workspace>
      ) : session.user && error ? (
        // The workspace could not load (offline, or the API refused): say so and offer a retry.
        <ErrorView
          error={error}
          retry={() => void qc.invalidateQueries()}
          home="/home"
          homeLabel={t('home')}
        />
      ) : (
        <WorkspaceLoading />
      )}
    </div>
  );
}
