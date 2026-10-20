'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { ErrorView, NotFoundView, StatusView } from '@/components/feedback';
import { STAFF_RULES, staffPasswordOk } from '@/features/admin-security';
import { cx, Ic, s } from '@/features/seller-shared';
import g from '@/features/admin-security/components/security.module.css';
import { api, isApiError, type AuthSession } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useRouter } from '@/lib/i18n/navigation';

interface Preview {
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  invitedBy: string;
  expiresAt: string;
  accountExists: boolean;
  accountHasPassword: boolean;
}

/**
 * `/staff-invite/{token}` (docs/api/phase9-staff-security.md § Invites): join VirtualBiz staff.
 * A new person picks a name and a staff-strength password; an existing account confirms its
 * password. Then they are signed in and the console asks them to set up two-step sign-in.
 */
export function InviteAcceptPage({ token }: { token: string }) {
  const t = useTranslations('admin.invite');
  const tr = useTranslations('admin.users.role');
  const session = useSession();
  const router = useRouter();
  const { data, error, refetch } = useQuery({
    queryKey: ['staff-invite', token],
    queryFn: () => api.get<Preview>(`/staff-invites/${encodeURIComponent(token)}`, { auth: false }),
    retry: false,
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) {
    if (isApiError(error, 'INVITE_NOT_FOUND'))
      return <NotFoundView title={t('notFoundTitle')} body={t('notFoundBody')} />;
    if (isApiError(error, 'INVITE_EXPIRED'))
      return <StatusView kind="empty" title={t('expiredTitle')} body={t('expiredBody')} />;
    return <ErrorView error={error} retry={() => void refetch()} />;
  }
  if (!data) return <div className={g.wrap} aria-busy="true" />;

  const existing = data.accountExists && data.accountHasPassword;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!existing) {
      if (!staffPasswordOk(password, data.email)) return setErr(t('rulesNotMet'));
      if (password !== confirm) return setErr(t('mismatch'));
    }
    setBusy(true);
    try {
      const res = await api.post<AuthSession>(
        `/staff-invites/${encodeURIComponent(token)}/accept`,
        { password, ...(existing ? {} : { name: name.trim() || data.name }) },
        { auth: false },
      );
      session.signIn(res, 'PASSWORD');
      router.replace('/admin');
    } catch (x) {
      setErr(
        isApiError(x, 'INVALID_CREDENTIALS')
          ? t('wrongPassword')
          : isApiError(x, 'ACCOUNT_LOCKED')
            ? t('locked')
            : isApiError(x, 'VALIDATION_FAILED')
              ? t('rulesNotMet')
              : isApiError(x, 'INVITE_EXPIRED')
                ? t('expiredBody')
                : t('failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.root}>
      <div className={g.wrap}>
        <section className={cx(s.panel, g.card)} aria-labelledby="invite-title">
          <div className={g.brand}>
            <span className={g.mark}>B</span>
            VirtualBiz
          </div>
          <h1 id="invite-title">{t('title', { role: tr(data.role) })}</h1>
          <p className={g.lead}>{t('lead', { name: data.invitedBy, email: data.email })}</p>
          <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
            {existing ? (
              <div className={s.field}>
                <label htmlFor="inv-pw">{t('yourPassword')}</label>
                <input
                  id="inv-pw"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErr('');
                  }}
                />
                <span className={s.hint}>{t('existingHint')}</span>
              </div>
            ) : (
              <>
                <div className={s.field}>
                  <label htmlFor="inv-name">{t('name')}</label>
                  <input
                    id="inv-name"
                    autoComplete="name"
                    placeholder={data.name}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="inv-new">{t('newPassword')}</label>
                  <input
                    id="inv-new"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErr('');
                    }}
                  />
                  <ul className={g.rules}>
                    {STAFF_RULES.map(([k, ok]) => (
                      <li key={k} className={cx(ok(password) && g.ok)}>
                        <Ic name={ok(password) ? 'check' : 'minus'} size={14} />
                        {t(`rule.${k}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={s.field}>
                  <label htmlFor="inv-confirm">{t('confirm')}</label>
                  <input
                    id="inv-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setErr('');
                    }}
                  />
                </div>
              </>
            )}
            {err && (
              <p className={g.err} role="alert">
                {err}
              </p>
            )}
            <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={busy || !password}>
              {t('join')}
            </button>
            <span className={g.small}>{t('next')}</span>
          </form>
        </section>
      </div>
    </div>
  );
}
