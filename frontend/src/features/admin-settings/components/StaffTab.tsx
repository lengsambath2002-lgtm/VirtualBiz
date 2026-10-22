'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { RecoveryCodes, securityApi, SetupStep, useStaffSecurity } from '@/features/admin-security';
import { adminApi, useAdminAction, useStaff, useStaffInvites } from '@/features/admin-shared/api';
import { Avatar, Loading, PanelError, Pill } from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type { PlatformRole, StaffInvite, StaffMember } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, Ic, s } from '@/features/seller-shared';
import { isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { Link } from '@/lib/i18n/navigation';

import c from './settings.module.css';

const ROLES: PlatformRole[] = ['ADMIN', 'SUPER_ADMIN'];

/** Settings → Staff: your own sign-in security, the staff list, invites (docs/api/phase9). */
export function StaffTab() {
  const isSuper = useSession().user?.platformRole === 'SUPER_ADMIN';
  return (
    <>
      <YourSecurity />
      <Team isSuper={isSuper} />
      <Invites isSuper={isSuper} />
    </>
  );
}

function YourSecurity() {
  const t = useTranslations('admin.staff');
  const { data, refetch } = useStaffSecurity();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [turningOn, setTurningOn] = useState(false);
  const act = useAct();
  if (!data) return null;
  const low = data.enrolled && data.recoveryCodesLeft <= 3;
  return (
    <section className={s.panel} style={{ marginBottom: 16 }}>
      <div className={s.panelH}>
        <h2>{t('you')}</h2>
      </div>
      <div className={cx(s.panelB, c.secRow)}>
        <span className={cx(c.secIc, data.enrolled ? c.secOn : c.secOff)}>
          <Ic name={data.enrolled ? 'check' : 'alert'} size={18} />
        </span>
        <span>
          <strong>{data.enrolled ? t('mfaOn') : t('mfaOff')}</strong>
          <span className={cx(s.small, s.muted, s.block)}>
            {data.enrolled
              ? t('codesLeft', { n: data.recoveryCodesLeft })
              : data.mfaRequired
                ? t('mfaOffRequired')
                : t('mfaOffOptional')}
          </span>
          {low && <span className={cx(s.small, c.warnText, s.block)}>{t('codesLow')}</span>}
        </span>
        {!data.enrolled && (
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary, s.btnSm)}
            onClick={() => setTurningOn(true)}
          >
            {t('turnOn')}
          </button>
        )}
        {turningOn && (
          <div className={c.setupLayer}>
            <SetupStep
              status={{ ...data, mustChangePassword: false }}
              onCancel={() => setTurningOn(false)}
              onDone={() => {
                setTurningOn(false);
                void refetch();
              }}
            />
          </div>
        )}
        {data.enrolled && (
          <button
            type="button"
            className={cx(s.btn, s.btnGhost, s.btnSm)}
            onClick={() =>
              void act({
                title: t('newCodesTitle'),
                body: t('newCodesBody'),
                ok: t('newCodes'),
                done: t('newCodesDone'),
                run: () => securityApi.regenerate(),
              }).then((r) => {
                if (r) {
                  setCodes(r.codes);
                  void refetch();
                }
              })
            }
          >
            {t('newCodes')}
          </button>
        )}
      </div>
      {codes && (
        <div className={s.panelB} style={{ paddingTop: 0 }}>
          <p className={cx(s.small, s.muted)} style={{ margin: 0 }}>
            {t('newCodesShown')}
          </p>
          <RecoveryCodes codes={codes} />
        </div>
      )}
    </section>
  );
}

function Team({ isSuper }: { isSuper: boolean }) {
  const t = useTranslations('admin.staff');
  const tr = useTranslations('admin.users.role');
  const f = useAdminFmt();
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const { data, error, refetch } = useStaff();
  const [inviting, setInviting] = useState(false);

  const setRole = (m: StaffMember, role: PlatformRole | null) =>
    act({
      title: role
        ? t('roleTitle', { name: m.name, role: tr(role) })
        : t('removeTitle', { name: m.name }),
      body: role ? t('roleBody') : t('removeBody'),
      ok: role ? t('roleOk') : t('removeOk'),
      danger: !role,
      done: role ? t('roleDone') : t('removeDone', { name: m.name }),
      run: () => run.mutateAsync(() => adminApi.setRole(m.id, role)),
    });
  const resetMfa = (m: StaffMember) =>
    act({
      title: t('resetTitle', { name: m.name }),
      body: t('resetBody'),
      ok: t('resetOk'),
      danger: true,
      reason: 'required',
      reasonLabel: t('resetReason'),
      done: t('resetDone', { name: m.name }),
      run: (reason) => run.mutateAsync(() => adminApi.resetMfa(m.id, reason)),
    });

  return (
    <>
      <section className={s.panel} style={{ marginBottom: 16 }}>
        <div className={s.panelH}>
          <h2>
            {t('team')}{' '}
            {data && (
              <span className={cx(s.muted, s.num)} style={{ fontWeight: 400 }}>
                {data.length}
              </span>
            )}
          </h2>
          {isSuper && (
            <button
              type="button"
              className={cx(s.btn, s.btnPrimary, s.btnSm)}
              onClick={() => setInviting(true)}
            >
              <Ic name="plus" size={16} />
              {t('invite')}
            </button>
          )}
        </div>
        {error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : !data ? (
          <Loading />
        ) : (
          <div className={s.tblWrap}>
            <table className={c.staffTable}>
              <colgroup>
                <col />
                <col style={{ width: 170 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: isSuper ? 120 : 60 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t('thMember')}</th>
                  <th>{t('thRole')}</th>
                  <th>{t('thMfa')}</th>
                  <th>{t('thSeen')}</th>
                  <th aria-label={t('thActions')} />
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={c.cat}>
                        <Avatar name={m.name} url={m.avatarUrl} size={34} />
                        <span className={c.catName} style={{ minWidth: 0 }}>
                          <strong>
                            {m.name} {m.you && <Pill tone="neutral">{t('youPill')}</Pill>}{' '}
                            {m.suspended && <Pill tone="bad">{t('suspended')}</Pill>}
                          </strong>
                          <span>{m.email ?? '—'}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {isSuper && !m.you ? (
                        <select
                          className={s.select}
                          aria-label={t('roleLabel', { name: m.name })}
                          value={m.role}
                          onChange={(e) => void setRole(m, e.target.value as PlatformRole)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {tr(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Pill tone="info">{tr(m.role)}</Pill>
                      )}
                    </td>
                    <td>
                      {m.mfaEnabled ? (
                        <Pill tone="ok">{t('mfaOnShort')}</Pill>
                      ) : (
                        <Pill tone="warn">{t('mfaNotSet')}</Pill>
                      )}
                      {m.mustChangePassword && (
                        <span className={cx(s.tiny, s.muted, s.block)}>{t('mustChange')}</span>
                      )}
                    </td>
                    <td className={cx(s.small, s.muted)}>
                      {m.lastSeenAt ? f.dateTime(m.lastSeenAt) : t('never')}
                    </td>
                    <td>
                      <span className={c.acts}>
                        {isSuper && !m.you && m.mfaEnabled && (
                          <button
                            type="button"
                            className={c.act}
                            title={t('resetLabel', { name: m.name })}
                            aria-label={t('resetLabel', { name: m.name })}
                            onClick={() => void resetMfa(m)}
                          >
                            <Ic name="undo" size={16} />
                          </button>
                        )}
                        {isSuper && !m.you && (
                          <button
                            type="button"
                            className={c.act}
                            title={t('removeLabel', { name: m.name })}
                            aria-label={t('removeLabel', { name: m.name })}
                            onClick={() => void setRole(m, null)}
                          >
                            <Ic name="trash" size={16} />
                          </button>
                        )}
                        <Link
                          href={`/admin/users/${m.id}`}
                          className={c.act}
                          title={t('openLabel', { name: m.name })}
                          aria-label={t('openLabel', { name: m.name })}
                        >
                          <Ic name="right" size={16} />
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* Outside the panel: its backdrop filter would clip a fixed overlay to the panel. */}
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </>
  );
}

function Invites({ isSuper }: { isSuper: boolean }) {
  const t = useTranslations('admin.staff');
  const tr = useTranslations('admin.users.role');
  const f = useAdminFmt();
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const { data } = useStaffInvites();
  if (!data?.length) return null;
  const withdraw = (i: StaffInvite) =>
    act({
      title: t('withdrawTitle', { email: i.email }),
      body: t('withdrawBody'),
      ok: t('withdraw'),
      danger: true,
      done: t('withdrawn'),
      run: () => run.mutateAsync(() => adminApi.revokeInvite(i.id)),
    });
  return (
    <section className={s.panel}>
      <div className={s.panelH}>
        <h2>
          {t('pending')}{' '}
          <span className={cx(s.muted, s.num)} style={{ fontWeight: 400 }}>
            {data.length}
          </span>
        </h2>
      </div>
      <div className={s.panelB} style={{ gap: 10 }}>
        {data.map((i) => (
          <div key={i.id} className={c.invite}>
            <span className={cx(c.secIc, c.secOff)}>
              <Ic name="chat" size={16} />
            </span>
            <span style={{ minWidth: 0 }}>
              <strong className={s.block}>
                {i.name} · <span className={s.muted}>{i.email}</span>
              </strong>
              <span className={cx(s.small, s.muted)}>
                {tr(i.role)} · {t('invitedBy', { name: i.invitedByName })} ·{' '}
                {i.expired ? (
                  <Pill tone="bad">{t('expired')}</Pill>
                ) : (
                  t('expires', { when: f.dateTime(i.expiresAt) })
                )}
              </span>
            </span>
            {isSuper && (
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => void withdraw(i)}
              >
                {t('withdraw')}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('admin.staff');
  const tr = useTranslations('admin.users.role');
  const run = useAdminAction((fn: () => Promise<StaffInvite>) => fn());
  const [form, setForm] = useState({ name: '', email: '', role: 'ADMIN' as PlatformRole });
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<StaffInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const link =
    sent?.devLink && typeof window !== 'undefined'
      ? `${window.location.origin}/${document.documentElement.lang === 'km' ? 'kh' : 'en'}${sent.devLink}`
      : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad: Record<string, string> = {};
    if (form.name.trim().length < 2) bad.name = t('errName');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) bad.email = t('errEmail');
    setErr(bad);
    if (Object.keys(bad).length) return;
    try {
      setSent(
        await run.mutateAsync(() =>
          adminApi.inviteStaff({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
          }),
        ),
      );
    } catch (x) {
      setErr(isApiError(x, 'CONFLICT') ? { email: t('errAlready') } : { email: t('failed') });
    }
  };

  return (
    <div className={s.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={t('inviteTitle')}
        onSubmit={submit}
        noValidate
      >
        <button type="button" className={s.close} aria-label={t('close')} onClick={onClose}>
          <Ic name="x" size={18} />
        </button>
        <h2>{sent ? t('sentTitle') : t('inviteTitle')}</h2>
        {sent ? (
          <>
            <p className={s.muted} style={{ margin: 0 }}>
              {t('sentBody', { email: sent.email, role: tr(sent.role) })}
            </p>
            {link && (
              <div className={s.field}>
                <span className={s.lbl}>{t('devLink')}</span>
                <code className={c.devLink} data-testid="invite-link">
                  {link}
                </code>
                <span className={s.hint}>{t('devLinkHint')}</span>
                <button
                  type="button"
                  className={cx(s.btn, s.btnGhost, s.btnSm)}
                  style={{ justifySelf: 'start' }}
                  onClick={() =>
                    void navigator.clipboard?.writeText(link).then(() => setCopied(true))
                  }
                >
                  <Ic name="copy" size={16} />
                  {copied ? t('copied') : t('copyLink')}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={onClose}>
                {t('done')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={cx(s.small, s.muted)} style={{ marginTop: -6 }}>
              {t('inviteLead')}
            </p>
            <div className={s.g2}>
              <div className={cx(s.field, err.name && s.bad)}>
                <label htmlFor="inv-name">{t('name')}</label>
                <input
                  id="inv-name"
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
                />
                <div className={s.err}>{err.name}</div>
              </div>
              <div className={cx(s.field, err.email && s.bad)}>
                <label htmlFor="inv-email">{t('email')}</label>
                <input
                  id="inv-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((x) => ({ ...x, email: e.target.value }))}
                />
                <div className={s.err}>{err.email}</div>
              </div>
            </div>
            <div className={s.field} role="radiogroup" aria-label={t('role')}>
              <span className={s.lbl}>{t('role')}</span>
              {ROLES.map((r) => (
                <label key={r} className={cx(c.roleOpt, form.role === r && c.roleOn)}>
                  <input
                    type="radio"
                    name="inv-role"
                    checked={form.role === r}
                    onChange={() => setForm((x) => ({ ...x, role: r }))}
                  />
                  <span>
                    <strong>{tr(r)}</strong>
                    <span className={cx(s.small, s.muted, s.block)}>{t(`roleHelp.${r}`)}</span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className={cx(s.btn, s.btnGhost)} onClick={onClose}>
                {t('cancel')}
              </button>
              <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={run.isPending}>
                {t('send')}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
