'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { useMyRole } from '@/features/account-switcher';
import { isApiError, type ApiMember } from '@/lib/api';
import type { MemberRole } from '@/lib/domain';
import { useSession } from '@/lib/auth';
import { cn } from '@/lib/utils/cn';

import {
  MAX_INVITES,
  teamApi,
  useTeam,
  useTeamInvites,
  useTeamRefresh,
  type TeamInvite,
  type TeamInviteBatch,
} from '../api';
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
  // Former team members stay for their history (past bookings, sales); shown on request.
  const removed = (members ?? []).filter((m) => !m.active);
  const people = (members ?? []).filter((m) => m.active || showRemoved);

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
                {canManage(m) && (
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Addresses in typed or pasted text: split on commas, semicolons, spaces and new lines. */
const splitEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((x) => x.trim().replace(/^<|>$/g, ''))
    .filter(Boolean);

/**
 * Invite by email (docs/api/phase10-shop-team.md): several people at once, one role for all. Each
 * person gives their own name when they join. "Give a login" (`member`) invites one person for an
 * existing team member.
 */
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
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<Role>(member?.role === 'MANAGER' ? 'MANAGER' : 'STAFF');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TeamInviteBatch | null>(null);
  const [copied, setCopied] = useState('');
  const roles = myRole === 'OWNER' ? ROLES : (['STAFF'] as Role[]);
  const max = member ? 1 : MAX_INVITES;
  const linkOf = (i: TeamInvite) =>
    i.devLink && typeof window !== 'undefined'
      ? `${window.location.origin}/${document.documentElement.lang === 'km' ? 'kh' : 'en'}${i.devLink}`
      : null;

  /** Adds the addresses in `text` (once each, up to the limit); returns the new list. */
  const add = (text: string) => {
    const next = [...emails];
    for (const e of splitEmails(text)) {
      if (!next.some((x) => x.toLowerCase() === e.toLowerCase())) next.push(e);
    }
    if (next.length > max) setErr(t('errMax', { max }));
    else setErr('');
    const kept = next.slice(0, max);
    setEmails(kept);
    setDraft('');
    return kept;
  };
  const remove = (e: string) => {
    setEmails((xs) => xs.filter((x) => x !== e));
    setErr('');
  };
  const bad = emails.filter((e) => !EMAIL.test(e));

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const list = draft.trim() ? add(draft) : emails;
    if (!list.length) return setErr(t('errNone'));
    if (list.some((e) => !EMAIL.test(e))) return setErr(t('errInvalid'));
    setBusy(true);
    try {
      if (member) {
        const one = await teamApi.invite(businessId, {
          email: list[0]!,
          role,
          memberId: member.id,
        });
        setResult({ sent: [one], failed: [] });
      } else {
        const r = await teamApi.inviteMany(businessId, { emails: list, role });
        if (!r.sent.length && r.failed.length === 1) {
          // One address and it was refused: say why here, keep the form.
          setErr(why(r.failed[0]!.code));
          return;
        }
        setResult(r);
      }
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
  const why = (code: string) =>
    code === 'CONFLICT'
      ? t('errAlready')
      : code === 'VALIDATION_FAILED'
        ? t('errEmail')
        : code === 'FORBIDDEN'
          ? t('forbidden')
          : t('failed');
  const count = emails.length + (draft.trim() ? 1 : 0);

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
          {result
            ? t('sentMany', { n: result.sent.length })
            : member
              ? t('giveLoginTitle', { name: member.name })
              : t('inviteTitle')}
        </h2>
        {result ? (
          <>
            {!!result.sent.length && (
              <>
                <p className={t$.muted}>{t('sentManyBody')}</p>
                <ul className={t$.sentList}>
                  {result.sent.map((i) => {
                    const link = linkOf(i);
                    return (
                      <li key={i.id}>
                        <span className={t$.ok} aria-hidden>
                          ✓
                        </span>
                        <span className={t$.sentEmail}>{i.email}</span>
                        {link && (
                          <span className={t$.devLink}>
                            <code data-testid="team-invite-link">{link}</code>
                            <button
                              type="button"
                              className={t$.ghost}
                              onClick={() =>
                                void navigator.clipboard
                                  ?.writeText(link)
                                  .then(() => setCopied(i.id))
                              }
                            >
                              {copied === i.id ? t('copied') : t('copyLink')}
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {result.sent.some((i) => i.devLink) && (
                  <span className={t$.muted}>{t('devLinkHint')}</span>
                )}
              </>
            )}
            {!!result.failed.length && (
              <div role="alert" className={t$.notSent}>
                <strong>{t('notSent', { n: result.failed.length })}</strong>
                <ul>
                  {result.failed.map((f) => (
                    <li key={f.email}>
                      <span className={t$.sentEmail}>{f.email}</span>
                      <span className={t$.muted}>{why(f.code)}</span>
                    </li>
                  ))}
                </ul>
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
            <div className={t$.field}>
              <label htmlFor="team-emails">{member ? t('email') : t('emails')}</label>
              <div
                className={cn(t$.chips, err && t$.chipsBad)}
                onClick={(e) =>
                  (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()
                }
              >
                {emails.map((e) => (
                  <span
                    key={e}
                    className={cn(t$.chip, !EMAIL.test(e) && t$.chipBad)}
                    title={EMAIL.test(e) ? undefined : t('errEmail')}
                  >
                    {e}
                    <button
                      type="button"
                      aria-label={t('removeEmail', { email: e })}
                      onClick={() => remove(e)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {emails.length < max && (
                  <input
                    id="team-emails"
                    type="email"
                    multiple={!member}
                    autoComplete="off"
                    value={draft}
                    placeholder={emails.length ? '' : t('emailsPh')}
                    aria-describedby="team-emails-hint"
                    onChange={(e) => {
                      const v = e.target.value;
                      // A separator ends the address being typed.
                      if (/[\s,;]$/.test(v)) add(v);
                      else {
                        setDraft(v);
                        setErr('');
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (splitEmails(text).length > 1) {
                        e.preventDefault();
                        add(`${draft} ${text}`);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim()) {
                        e.preventDefault();
                        add(draft);
                      } else if (e.key === 'Backspace' && !draft && emails.length) {
                        remove(emails[emails.length - 1]!);
                      }
                    }}
                    onBlur={() => draft.trim() && add(draft)}
                  />
                )}
              </div>
              {!member && (
                <span id="team-emails-hint" className={t$.muted}>
                  {t('emailsHint', { max })}
                </span>
              )}
            </div>
            <fieldset className={t$.field}>
              <legend>{t('roleLabel')}</legend>
              {roles.map((r) => (
                <label key={r} className={cn(t$.opt, role === r && t$.optOn)}>
                  <input
                    type="radio"
                    name="team-role"
                    checked={role === r}
                    onChange={() => setRole(r)}
                  />
                  <span>
                    <strong>{t(`role.${r}`)}</strong>
                    <span className={t$.muted}>{t(`can.${r}`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {(err || bad.length > 0) && (
              <p className={t$.err} role="alert">
                {err || t('errInvalid')}
              </p>
            )}
            <div className={t$.btns}>
              <button type="button" className={t$.ghost} onClick={onClose}>
                {t('cancel')}
              </button>
              <button type="submit" className={t$.primary} disabled={busy}>
                {busy ? t('sending') : t('sendN', { n: count })}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
