'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { ErrorView, NotFoundView, StatusView } from '@/components/feedback';
import { WORKSPACE_HREF } from '@/features/account-switcher';
import { api, isApiError, type AuthSession } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { BusinessType, MemberRole } from '@/lib/domain';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { setActiveBusiness } from '@/lib/workspace';

import t$ from './team.module.css';
import j from './join.module.css';

interface Preview {
  businessId: string;
  businessName: string;
  businessType: BusinessType;
  logoUrl?: string | null;
  email: string;
  name: string;
  role: MemberRole;
  invitedBy: string;
  expiresAt: string;
  accountExists: boolean;
  accountHasPassword: boolean;
}

/**
 * `/join/{token}` (docs/api/phase10-shop-team.md), opened from the invite email's Accept or Decline
 * button. Signed in as the invited email: Accept adds the shop to the account, with the role, in one
 * click. An existing account not signed in signs in first (password, code or Google) and comes
 * back here; a new person picks a name and password. Decline asks once more, then closes the invite.
 */
export function JoinPage({ token }: { token: string }) {
  const t = useTranslations('team.join');
  const tr = useTranslations('team.role');
  const session = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const tc = useTranslations('team.can');
  const { data, error, refetch } = useQuery({
    queryKey: ['join', token],
    queryFn: () => api.get<Preview>(`/join/${encodeURIComponent(token)}`, { auth: false }),
    retry: false,
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  // The email's Decline button opens `?decline=1`.
  const [askDecline, setAskDecline] = useState(() => search.get('decline') === '1');

  if (error) {
    if (isApiError(error, 'INVITE_NOT_FOUND'))
      return <NotFoundView title={t('notFoundTitle')} body={t('notFoundBody')} />;
    if (isApiError(error, 'INVITE_EXPIRED'))
      return <StatusView kind="empty" title={t('expiredTitle')} body={t('expiredBody')} />;
    return <ErrorView error={error} retry={() => void refetch()} />;
  }
  if (!data) return <div className={j.wrap} aria-busy="true" />;

  const mine = !!session.user && session.user.email?.toLowerCase() === data.email.toLowerCase();
  const signInHref = `/sign-in?${new URLSearchParams({ email: data.email, next: `/join/${token}` })}`;
  // Invited by email alone, the invite's name is just the start of the address: ask for theirs.
  const suggested = data.name === data.email.split('@')[0] ? '' : data.name;
  const open = (b: { businessType: BusinessType; businessId: string }) => {
    setActiveBusiness(b.businessType, b.businessId);
    router.replace(WORKSPACE_HREF[b.businessType]);
  };
  const fail = (x: unknown) =>
    setErr(
      isApiError(x, 'VALIDATION_FAILED')
        ? t('weak')
        : isApiError(x, 'CONFLICT')
          ? t('already')
          : isApiError(x, 'INVITE_EXPIRED')
            ? t('expiredBody')
            : t('failed'),
    );

  /** Signed in as the invited email: one click, no password. */
  const acceptAsMe = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api.post<{ businessId: string; businessType: BusinessType }>(
        `/me/invites/${encodeURIComponent(token)}/accept`,
      );
      open(r);
    } catch (x) {
      fail(x);
      setBusy(false);
    }
  };

  /** A new person: their name and a password make the account. */
  const createAndJoin = async (e: FormEvent) => {
    e.preventDefault();
    if ((name.trim() || suggested).length < 2) return setErr(t('errName'));
    setBusy(true);
    setErr('');
    try {
      const res = await api.post<AuthSession>(
        `/join/${encodeURIComponent(token)}/accept`,
        { password, name: name.trim() || suggested },
        { auth: false },
      );
      session.signIn(res, 'PASSWORD');
      open(data);
    } catch (x) {
      fail(x);
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/join/${encodeURIComponent(token)}/decline`, undefined, { auth: false });
      setDeclined(true);
    } catch (x) {
      fail(x);
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <>
      <span
        className={j.logo}
        style={data.logoUrl ? { backgroundImage: `url(${data.logoUrl})` } : undefined}
      >
        {data.logoUrl ? null : data.businessName.slice(0, 1).toUpperCase()}
      </span>
      <h1 id="join-title">{t('title', { shop: data.businessName })}</h1>
      <p className={t$.muted}>
        {t('lead', { name: data.invitedBy, email: data.email, role: tr(data.role) })}
      </p>
      <p className={j.role}>
        <strong>{tr(data.role)}</strong>
        <span>{tc(data.role)}</span>
      </p>
    </>
  );
  const alert = err && (
    <p className={t$.err} role="alert">
      {err}
    </p>
  );

  if (declined)
    return (
      <div className={j.wrap}>
        <div className={cnPanel()} role="status">
          <h1>{t('declinedTitle')}</h1>
          <p className={t$.muted}>{t('declinedBody', { shop: data.businessName })}</p>
        </div>
      </div>
    );

  // From the email's Decline button: confirm with one click (a link alone never declines).
  if (askDecline)
    return (
      <div className={j.wrap}>
        <div className={cnPanel()} aria-labelledby="join-title">
          {head}
          <p>{t('declineAsk')}</p>
          {alert}
          <div className={j.btns}>
            <button
              type="button"
              className={t$.danger}
              disabled={busy}
              onClick={() => void decline()}
            >
              {t('decline')}
            </button>
            <button type="button" className={t$.ghost} onClick={() => setAskDecline(false)}>
              {t('acceptInstead')}
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className={j.wrap}>
      {mine ? (
        <div className={cnPanel()} aria-labelledby="join-title">
          {head}
          <p className={t$.muted}>{t('asYou', { name: session.user!.name })}</p>
          {alert}
          <div className={j.btns}>
            <button
              type="button"
              className={t$.primary}
              disabled={busy}
              onClick={() => void acceptAsMe()}
            >
              {t('accept')}
            </button>
            <button
              type="button"
              className={t$.ghost}
              disabled={busy}
              onClick={() => setAskDecline(true)}
            >
              {t('decline')}
            </button>
          </div>
        </div>
      ) : session.user ? (
        // Signed in as someone else: the invite belongs to its email's account.
        <div className={cnPanel()} aria-labelledby="join-title">
          {head}
          <p className={t$.muted}>
            {t('otherAccount', { me: session.user.email ?? session.user.name, email: data.email })}
          </p>
          <div className={j.btns}>
            <button
              type="button"
              className={t$.primary}
              onClick={() => {
                void session.signOut();
                router.push(signInHref);
              }}
            >
              {t('switchAccount', { email: data.email })}
            </button>
            <button type="button" className={t$.ghost} onClick={() => setAskDecline(true)}>
              {t('decline')}
            </button>
          </div>
        </div>
      ) : data.accountExists ? (
        // Has a VirtualBiz account: sign in (password, code or Google) and come back to accept.
        <div className={cnPanel()} aria-labelledby="join-title">
          {head}
          <p className={t$.muted}>{t('signInToAccept', { email: data.email })}</p>
          <div className={j.btns}>
            <Link className={t$.primary} href={signInHref}>
              {t('signInAccept')}
            </Link>
            <button type="button" className={t$.ghost} onClick={() => setAskDecline(true)}>
              {t('decline')}
            </button>
          </div>
        </div>
      ) : (
        <form
          className={cnPanel()}
          onSubmit={createAndJoin}
          noValidate
          aria-labelledby="join-title"
        >
          {head}
          <label className={t$.field}>
            <span>{t('name')}</span>
            <input
              autoComplete="name"
              required={!suggested}
              placeholder={suggested || t('namePh')}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={t$.field}>
            <span>{t('newPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className={t$.muted}>{t('passwordHint')}</span>
          </label>
          {alert}
          <button type="submit" className={t$.primary} disabled={busy || !password}>
            {t('join', { shop: data.businessName })}
          </button>
          <button type="button" className={j.quiet} onClick={() => setAskDecline(true)}>
            {t('declineLink')}
          </button>
        </form>
      )}
    </div>
  );
}

const cnPanel = () => `${t$.panel} ${j.card}`;
