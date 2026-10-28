'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { ErrorView, feedbackButton, StatusView } from '@/components/feedback';
import { useFlowStore } from '@/features/auth/store';
import { isApiError, metaString } from '@/lib/api';
import { useSessionStore } from '@/lib/auth';
import { Link, useRouter } from '@/lib/i18n/navigation';

import { completePlatform } from '../api';
import type { PlatformRoute, PlatformSession } from '../types';
import { savedLink, saveLink, savedRoute, saveRoute } from '../util/pending';
import { goToPlatform } from '../util/start';
import { useRouteAfterPlatform } from '../hooks/useRouteAfterPlatform';
import { LinkAccounts } from './LinkAccounts';
import { NoAccess } from './NoAccess';
import s from './platform.module.css';

type View =
  | { k: 'working' }
  | { k: 'denied' }
  | { k: 'login' }
  | { k: 'expired' }
  | { k: 'suspended' }
  | { k: 'unavailable' }
  | { k: 'missing' }
  | { k: 'noAccess' }
  | { k: 'link' }
  | { k: 'error'; error: unknown };

/** One exchange per code, even when React runs the effect twice (a code works once). */
const exchanges = new Map<string, Promise<PlatformSession>>();
const exchange = (code: string, state: string) => {
  const key = `${state}:${code}`;
  let p = exchanges.get(key);
  if (!p) {
    p = completePlatform(code, state);
    exchanges.set(key, p);
  }
  return p;
};

/**
 * `/platform/callback`: the platform sends the browser back here with `code` + `state` (or
 * `error`). The code goes to the API, which answers with a session (signed in here, then on to the
 * intent's page), TWO_STEP_REQUIRED (the usual two-step screen, then back here with `?resume=1`) or
 * LINK_REQUIRED (`?link=1`: sign in to the existing account and confirm).
 */
export function PlatformCallback() {
  const t = useTranslations('platform.callback');
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const resume = params.get('resume') === '1';
  const linkStep = params.get('link') === '1';
  const [view, setView] = useState<View>({ k: 'working' });
  const noAccess = useCallback(() => setView({ k: 'noAccess' }), []);
  const routeAfter = useRouteAfterPlatform(noAccess);

  useEffect(() => {
    if (error) {
      setView(
        error === 'access_denied'
          ? { k: 'denied' }
          : error === 'login_required' || error === 'consent_required'
            ? { k: 'login' }
            : { k: 'error', error: null },
      );
      return;
    }
    if (code && state) {
      let live = true;
      exchange(code, state).then(
        (session) => {
          if (!live) return;
          useSessionStore.getState().signIn(session, 'PLATFORM');
          routeAfter(session);
        },
        async (e: unknown) => {
          if (!live) return;
          if (isApiError(e, 'TWO_STEP_REQUIRED')) {
            const ticket = metaString(e, 'ticket');
            const route = e.meta<PlatformRoute>('route');
            if (ticket) {
              saveRoute(route ?? null);
              // Someone else signed in on this browser: the code finishes this person's sign-in.
              if (useSessionStore.getState().user) await useSessionStore.getState().signOut();
              useFlowStore.getState().patch({
                twoStep: { ticket, method: 'platform' },
                leaving: false,
                target: null,
              });
              router.replace({
                pathname: '/sign-in',
                query: { step: 'two-step', next: '/platform/callback?resume=1' },
              });
              return;
            }
          }
          if (isApiError(e, 'LINK_REQUIRED')) {
            const ticket = metaString(e, 'ticket');
            if (ticket) {
              saveLink({
                ticket,
                email: metaString(e, 'email') ?? '',
                name: metaString(e, 'name') ?? '',
              });
              router.replace('/platform/callback?link=1');
              setView({ k: 'link' });
              return;
            }
          }
          setView(
            isApiError(e, 'INVALID_TOKEN')
              ? { k: 'expired' }
              : isApiError(e, 'ACCOUNT_SUSPENDED')
                ? { k: 'suspended' }
                : isApiError(e, 'NOT_CONFIGURED')
                  ? { k: 'unavailable' }
                  : { k: 'error', error: e },
          );
        },
      );
      return () => {
        live = false;
      };
    }
    if (resume) {
      const r = savedRoute();
      // Two-step finished and the session is in: go where the sign-in was headed.
      if (r && useSessionStore.getState().user) routeAfter(r);
      else setView({ k: 'missing' });
      return;
    }
    if (linkStep) {
      setView(savedLink() ? { k: 'link' } : { k: 'expired' });
      return;
    }
    setView({ k: 'missing' });
  }, [code, state, error, resume, linkStep, routeAfter, router]);

  const again = () => {
    setView({ k: 'working' });
    goToPlatform({ intent: 'signin' }).catch((e: unknown) =>
      setView(isApiError(e, 'NOT_CONFIGURED') ? { k: 'unavailable' } : { k: 'error', error: e }),
    );
  };
  const againBtn = (
    <button type="button" className={feedbackButton(true)} onClick={again}>
      {t('again')}
    </button>
  );
  const signInLink = (primary = false) => (
    <Link className={feedbackButton(primary)} href="/sign-in">
      {t('signIn')}
    </Link>
  );
  const homeLink = (
    <Link className={feedbackButton()} href="/home">
      {t('home')}
    </Link>
  );

  switch (view.k) {
    case 'working':
      return (
        <div className={s.wrap}>
          <div className={s.card} role="status" aria-live="polite">
            <span className={s.spin} aria-hidden="true" />
            <p className={s.muted} style={{ textAlign: 'center' }}>
              {t('working')}
            </p>
          </div>
        </div>
      );
    case 'link':
      return <LinkAccounts onExpired={() => setView({ k: 'expired' })} onNoAccess={noAccess} />;
    case 'denied':
      return (
        <StatusView
          kind="forbidden"
          title={t('deniedTitle')}
          body={t('deniedBody')}
          actions={
            <>
              {againBtn}
              {signInLink()}
            </>
          }
        />
      );
    case 'login':
      return (
        <StatusView
          kind="forbidden"
          title={t('loginTitle')}
          body={t('loginBody')}
          actions={
            <>
              {againBtn}
              {signInLink()}
            </>
          }
        />
      );
    case 'expired':
      return (
        <StatusView
          kind="error"
          title={t('expiredTitle')}
          body={t('expiredBody')}
          actions={
            <>
              {againBtn}
              {signInLink()}
            </>
          }
        />
      );
    case 'suspended':
      return (
        <StatusView
          kind="forbidden"
          title={t('suspendedTitle')}
          body={t('suspendedBody')}
          actions={homeLink}
        />
      );
    case 'unavailable':
      return (
        <StatusView
          kind="error"
          title={t('unavailableTitle')}
          body={t('unavailableBody')}
          actions={signInLink(true)}
        />
      );
    case 'noAccess':
      return <NoAccess />;
    case 'missing':
      return (
        <StatusView
          kind="notFound"
          title={t('missingTitle')}
          body={t('missingBody')}
          actions={
            <>
              {signInLink(true)}
              {homeLink}
            </>
          }
        />
      );
    case 'error':
      return <ErrorView error={view.error} retry={again} />;
  }
}
