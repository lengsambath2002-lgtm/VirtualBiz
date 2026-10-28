'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { Link, useRouter } from '@/lib/i18n/navigation';

import { linkPlatform } from '../api';
import { savedLink, saveLink } from '../util/pending';
import { useRouteAfterPlatform } from '../hooks/useRouteAfterPlatform';
import { PlatformMark } from './PlatformMark';
import s from './platform.module.css';

const BACK_HERE = '/platform/callback?link=1';

/**
 * LINK_REQUIRED: a VirtualBiz account already uses the platform account's email. Nothing is linked
 * on email alone: the person signs in to that account the usual way (password, code, Google, with
 * two-step if on), comes back here and confirms. Only then is the platform account linked.
 */
export function LinkAccounts({
  onExpired,
  onNoAccess,
}: {
  onExpired: () => void;
  onNoAccess: () => void;
}) {
  const t = useTranslations('platform.link');
  const session = useSession();
  const router = useRouter();
  const routeAfter = useRouteAfterPlatform(onNoAccess);
  const [pending] = useState(savedLink);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const signInHref = { pathname: '/sign-in' as const, query: { next: BACK_HERE } };

  useEffect(() => {
    if (!pending) onExpired();
  }, [pending, onExpired]);

  if (!pending) return null;
  if (!session.ready || !session.validated) {
    return (
      <div className={s.wrap}>
        <div className={s.card} aria-busy="true">
          <span className={s.spin} aria-hidden="true" />
        </div>
      </div>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setErr('');
    try {
      const route = await linkPlatform(pending.ticket);
      saveLink(null);
      routeAfter(route);
    } catch (e) {
      setBusy(false);
      if (isApiError(e, 'INVALID_TOKEN')) {
        saveLink(null);
        return onExpired();
      }
      setErr(
        isApiError(e, 'FORBIDDEN') && e.meta('reason') === 'WRONG_ACCOUNT'
          ? t('wrongAccount')
          : isApiError(e, 'CONFLICT')
            ? t('conflict')
            : t('failed'),
      );
    }
  };

  const otherAccount = async () => {
    await session.signOut();
    router.push(signInHref);
  };

  const user = session.user;
  return (
    <div className={s.wrap}>
      <div className={s.card} aria-labelledby="pf-link-title">
        <span className={s.mark}>
          <PlatformMark size={24} />
        </span>
        {user ? (
          <>
            <h1 id="pf-link-title">{t('confirmTitle')}</h1>
            <p className={s.muted}>{t('confirmLead', { account: user.email ?? user.name })}</p>
            {pending.name && (
              <p className={s.note}>{t('platformAccount', { name: pending.name })}</p>
            )}
            {err && (
              <p className={s.err} role="alert">
                {err}
              </p>
            )}
            <div className={s.btns}>
              <button
                type="button"
                className={s.primary}
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? t('linking') : t('confirm')}
              </button>
              <button
                type="button"
                className={s.ghost}
                disabled={busy}
                onClick={() => void otherAccount()}
              >
                {t('otherAccount')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 id="pf-link-title">{t('title')}</h1>
            <p className={s.muted}>{t('lead', { email: pending.email })}</p>
            {pending.name && (
              <p className={s.note}>{t('platformAccount', { name: pending.name })}</p>
            )}
            <p className={s.muted}>{t('why')}</p>
            <div className={s.btns}>
              <Link className={s.primary} href={signInHref}>
                {t('signIn')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
