'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { useMyRole } from '@/features/account-switcher';
import { isApiError, type ApiMember } from '@/lib/api';
import type { MemberRole } from '@/lib/domain';
import { useSession } from '@/lib/auth';
import { cn } from '@/lib/utils/cn';

import { teamApi, useTeam, useTeamInvites, useTeamRefresh, type TeamInvite } from '../api';
import t$ from './team.module.css';

type Role = TeamInvite['role'];
const ROLES: Role[] = ['MANAGER', 'STAFF'];

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * "People and access" for a shop (docs/api/phase10-shop-team.md): who can sign in to this
 * workspace and with which role, invites, and removing access. The same panel in the seller
 * and provider workspaces; the backend enforces every rule, the panel only hides what the
 * signed-in member's role can't do.
 */
export function TeamAccess({ businessId }: { businessId: string }) {
  const t = useTranslations('team');
  const me = useSession().user;
  const myRole = useMyRole(businessId);
  const lead = myRole === 'OWNER' || myRole === 'MANAGER';
  const { data: members, error, refetch } = useTeam(businessId);
  const { data: invites } = useTeamInvites(businessId, lead);
  const refresh = useTeamRefresh(businessId);
  const [inviting, setInviting] = useState<{ member?: ApiMember } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRoles, setShowRoles] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  const canManage = (m: ApiMember) =>
    m.role !== 'OWNER' && m.userId !== me?.id && (myRole === 'OWNER' || m.role === 'STAFF') && lead;

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      await refresh();
      setNotice(done);
    } catch (e) {
      setNotice(isApiError(e, 'FORBIDDEN') ? t('forbidden') : t('failed'));
    } finally {
      setBusy(null);
    }
  };

  const roleLabel = (r: MemberRole) => t(`role.${r}`);
  // Former team members (removed logins) stay for their history; shown on request.
  const removed = (members ?? []).filter((m) => m.userId && !m.active);
  const people = (members ?? []).filter((m) => m.active || (showRemoved && m.userId));

  return (
    <section className={t$.panel} aria-labelledby="team-access-title">
      <div className={t$.head}>
        <div>
          <h2 id="team-access-title">{t('title')}</h2>
          <p>{t('sub')}</p>
        </div>
        {lead && (
          <button type="button" className={t$.primary} onClick={() => setInviting({})}>
            {t('invite')}
          </button>
        )}
      </div>

      <button type="button" className={t$.link} onClick={() => setShowRoles((v) => !v)}>
        {showRoles ? t('rolesHide') : t('rolesShow')}
      </button>
      {showRoles && (
        <dl className={t$.roles}>
          {(['OWNER', 'MANAGER', 'STAFF'] as const).map((r) => (
            <div key={r}>
              <dt>{roleLabel(r)}</dt>
              <dd>{t(`can.${r}`)}</dd>
            </div>
          ))}
        </dl>
      )}

      {notice && (
        <p className={t$.notice} role="status">
          {notice}
        </p>
      )}

      {error && !members ? (
        <p className={t$.err}>
          {t('loadFailed')}{' '}
          <button type="button" className={t$.link} onClick={() => void refetch()}>
            {t('retry')}
          </button>
        </p>
      ) : !members ? (
        <div className={t$.loading} aria-busy="true" />
      ) : (
        <ul className={t$.list}>
          {people.map((m) => (
            <li key={m.id} className={cn(t$.row, !m.active && t$.off)}>
              <span
                className={t$.av}
                style={m.color ? { background: m.color, color: '#fff' } : undefined}
              >
                {initials(m.name)}
              </span>
              <span className={t$.who}>
                <strong>
                  {m.name}
                  {m.userId === me?.id && <em className={t$.you}>{t('you')}</em>}
                </strong>
                <span>
                  {m.userId ? (m.email ?? t('hasLogin')) : t('noLogin')}
                  {!m.active && ` · ${t('removed')}`}
                </span>
              </span>
              <span className={t$.role}>
                {myRole === 'OWNER' && m.role !== 'OWNER' && m.active && m.userId !== me?.id ? (
                  <select
                    aria-label={t('roleOf', { name: m.name })}
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={(e) =>
                      void run(
                        m.id,
                        () => teamApi.patch(businessId, m.id, { role: e.target.value as Role }),
                        t('roleChanged', { name: m.name, role: roleLabel(e.target.value as Role) }),
                      )
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={cn(t$.pill, m.role === 'OWNER' && t$.pillOwner)}>
                    {roleLabel(m.role)}
                  </span>
                )}
              </span>
              <span className={t$.acts}>
                {canManage(m) && !m.userId && m.active && (
                  <button
                    type="button"
                    className={t$.ghost}
                    onClick={() => setInviting({ member: m })}
                  >
                    {t('giveLogin')}
                  </button>
                )}
                {canManage(m) && m.userId && (
                  <button
                    type="button"
                    className={t$.ghost}
                    disabled={busy === m.id}
                    onClick={() =>
                      void run(
                        m.id,
                        () => teamApi.patch(businessId, m.id, { active: !m.active }),
                        m.active
                          ? t('removedDone', { name: m.name })
                          : t('restoredDone', { name: m.name }),
                      )
                    }
                  >
                    {m.active ? t('remove') : t('restore')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!!removed.length && (
        <button type="button" className={t$.link} onClick={() => setShowRemoved((v) => !v)}>
          {showRemoved ? t('removedHide') : t('removedShow', { n: removed.length })}
        </button>
      )}

      {lead && !!invites?.length && (
        <>
          <h3 className={t$.subH}>{t('pending')}</h3>
          <ul className={t$.list}>
            {invites.map((i) => (
              <li key={i.id} className={t$.row}>
                <span className={cn(t$.av, t$.avPending)}>@</span>
                <span className={t$.who}>
                  <strong>{i.name}</strong>
                  <span>
                    {i.email} · {roleLabel(i.role)} ·{' '}
                    {i.expired ? t('expired') : t('invitedBy', { name: i.invitedByName })}
                  </span>
                </span>
                <span />
                <span className={t$.acts}>
                  {(myRole === 'OWNER' || i.role === 'STAFF') && (
                    <button
                      type="button"
                      className={t$.ghost}
                      disabled={busy === i.id}
                      onClick={() =>
                        void run(i.id, () => teamApi.revoke(businessId, i.id), t('withdrawn'))
                      }
                    >
                      {t('withdraw')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {inviting && myRole && (
        <InviteDialog
          businessId={businessId}
          myRole={myRole}
          member={inviting.member}
          onClose={() => setInviting(null)}
          onSent={() => void refresh()}
        />
      )}
    </section>
  );
}

function InviteDialog({
  businessId,
  myRole,
  member,
  onClose,
  onSent,
}: {
  businessId: string;
  myRole: MemberRole;
  member?: ApiMember;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useTranslations('team');
  const [form, setForm] = useState({
    name: member?.name ?? '',
    email: '',
    role: (member?.role === 'MANAGER' ? 'MANAGER' : 'STAFF') as Role,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<TeamInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const roles = myRole === 'OWNER' ? ROLES : (['STAFF'] as Role[]);
  const link =
    sent?.devLink && typeof window !== 'undefined'
      ? `${window.location.origin}/${document.documentElement.lang === 'km' ? 'kh' : 'en'}${sent.devLink}`
      : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setErr(t('errEmail'));
    setBusy(true);
    try {
      setSent(
        await teamApi.invite(businessId, {
          email: form.email.trim(),
          role: form.role,
          ...(form.name.trim() ? { name: form.name.trim() } : {}),
          ...(member ? { memberId: member.id } : {}),
        }),
      );
      onSent();
    } catch (x) {
      setErr(
        isApiError(x, 'CONFLICT')
          ? t('errAlready')
          : isApiError(x, 'FORBIDDEN')
            ? t('forbidden')
            : t('failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={t$.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={t$.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={member ? t('giveLoginTitle', { name: member.name }) : t('inviteTitle')}
        onSubmit={submit}
        noValidate
      >
        <h2>
          {sent
            ? t('sentTitle')
            : member
              ? t('giveLoginTitle', { name: member.name })
              : t('inviteTitle')}
        </h2>
        {sent ? (
          <>
            <p className={t$.muted}>{t('sentBody', { email: sent.email })}</p>
            {link && (
              <div className={t$.devLink}>
                <code data-testid="team-invite-link">{link}</code>
                <span className={t$.muted}>{t('devLinkHint')}</span>
                <button
                  type="button"
                  className={t$.ghost}
                  onClick={() =>
                    void navigator.clipboard?.writeText(link).then(() => setCopied(true))
                  }
                >
                  {copied ? t('copied') : t('copyLink')}
                </button>
              </div>
            )}
            <div className={t$.btns}>
              <button type="button" className={t$.primary} onClick={onClose}>
                {t('done')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={t$.muted}>{member ? t('giveLoginLead') : t('inviteLead')}</p>
            {!member && (
              <label className={t$.field}>
                <span>{t('name')}</span>
                <input
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
            )}
            <label className={t$.field}>
              <span>{t('email')}</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }));
                  setErr('');
                }}
              />
            </label>
            <fieldset className={t$.field}>
              <legend>{t('roleLabel')}</legend>
              {roles.map((r) => (
                <label key={r} className={cn(t$.opt, form.role === r && t$.optOn)}>
                  <input
                    type="radio"
                    name="team-role"
                    checked={form.role === r}
                    onChange={() => setForm((f) => ({ ...f, role: r }))}
                  />
                  <span>
                    <strong>{t(`role.${r}`)}</strong>
                    <span className={t$.muted}>{t(`can.${r}`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {err && (
              <p className={t$.err} role="alert">
                {err}
              </p>
            )}
            <div className={t$.btns}>
              <button type="button" className={t$.ghost} onClick={onClose}>
                {t('cancel')}
              </button>
              <button type="submit" className={t$.primary} disabled={busy}>
                {t('send')}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
