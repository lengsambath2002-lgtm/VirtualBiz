'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { ErrorView, NotFoundView, StatusView } from '@/components/feedback';
import { WORKSPACE_HREF } from '@/features/account-switcher';
import { api, isApiError, type AuthSession } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { BusinessType, MemberRole } from '@/lib/domain';
import { useRouter } from '@/lib/i18n/navigation';
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
 * `/join/{token}` (docs/api/phase10-shop-team.md): join a shop's team. A new person picks a
 * name and password; an existing account confirms its password. Then they're signed in and the
 * shop's workspace opens.
 */
export function JoinPage({ token }: { token: string }) {
  const t = useTranslations('team.join');
  const tr = useTranslations('team.role');
  const session = useSession();
  const router = useRouter();
  const { data, error, refetch } = useQuery({
    queryKey: ['join', token],
    queryFn: () => api.get<Preview>(`/join/${encodeURIComponent(token)}`, { auth: false }),
    retry: false,
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) {
    if (isApiError(error, 'INVITE_NOT_FOUND'))
      return <NotFoundView title={t('notFoundTitle')} body={t('notFoundBody')} />;
    if (isApiError(error, 'INVITE_EXPIRED'))
      return <StatusView kind="empty" title={t('expiredTitle')} body={t('expiredBody')} />;
    return <ErrorView error={error} retry={() => void refetch()} />;
  }
  if (!data) return <div className={j.wrap} aria-busy="true" />;

  const existing = data.accountExists && data.accountHasPassword;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await api.post<AuthSession>(
        `/join/${encodeURIComponent(token)}/accept`,
        { password, ...(existing ? {} : { name: name.trim() || data.name }) },
        { auth: false },
      );
      session.signIn(res, 'PASSWORD');
      setActiveBusiness(data.businessType, data.businessId);
      router.replace(WORKSPACE_HREF[data.businessType]);
    } catch (x) {
      setErr(
        isApiError(x, 'INVALID_CREDENTIALS')
          ? t('wrongPassword')
          : isApiError(x, 'ACCOUNT_LOCKED')
            ? t('locked')
            : isApiError(x, 'VALIDATION_FAILED')
              ? t('weak')
              : isApiError(x, 'CONFLICT')
                ? t('already')
                : isApiError(x, 'INVITE_EXPIRED')
                  ? t('expiredBody')
                  : t('failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={j.wrap}>
      <form className={cnPanel()} onSubmit={submit} noValidate aria-labelledby="join-title">
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
        {existing ? (
          <label className={t$.field}>
            <span>{t('yourPassword')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className={t$.muted}>{t('existingHint')}</span>
          </label>
        ) : (
          <>
            <label className={t$.field}>
              <span>{t('name')}</span>
              <input
                autoComplete="name"
                placeholder={data.name}
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
          </>
        )}
        {err && (
          <p className={t$.err} role="alert">
            {err}
          </p>
        )}
        <button type="submit" className={t$.primary} disabled={busy || !password}>
          {t('join', { shop: data.businessName })}
        </button>
      </form>
    </div>
  );
}

const cnPanel = () => `${t$.panel} ${j.card}`;
