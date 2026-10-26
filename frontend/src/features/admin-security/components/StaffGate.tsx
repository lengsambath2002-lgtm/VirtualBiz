'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { LogoGlyph, QrCode } from '@/components/ui';
import { cx, Ic, s } from '@/features/seller-shared';
import { isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useRouter } from '@/lib/i18n/navigation';

import {
  GATE_CODES,
  securityApi,
  securityKey,
  STAFF_RULES,
  staffPasswordOk,
  useStaffSecurity,
  type StaffSecurity,
} from '../api';
import g from './security.module.css';

/** New recovery codes: shown once, with copy and download. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const t = useTranslations('admin.security');
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  return (
    <>
      <div className={g.codes} data-testid="recovery-codes">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className={g.row}>
        <button
          type="button"
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
        >
          <Ic name="copy" size={16} />
          {copied ? t('copied') : t('copy')}
        </button>
        <a
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          download="virtualbiz-recovery-codes.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`VirtualBiz recovery codes\n\n${text}\n`)}`}
        >
          <Ic name="upload" size={16} />
          {t('download')}
        </a>
      </div>
    </>
  );
}

function Frame({
  step,
  of,
  title,
  lead,
  children,
  onCancel,
}: {
  step: number;
  of: number;
  title: string;
  lead: string;
  children: ReactNode;
  /** Opened by choice (Settings → Staff): Cancel instead of Sign out. */
  onCancel?: () => void;
}) {
  const t = useTranslations('admin.security');
  const { signOut } = useSession();
  const router = useRouter();
  return (
    <div className={g.wrap}>
      <section className={cx(s.panel, g.card)} aria-labelledby="gate-title">
        <div className={g.brand}>
          <span className={g.mark} aria-hidden="true">
            <LogoGlyph />
          </span>
          {t('brand')}
        </div>
        {of > 1 && (
          <div className={g.steps} aria-label={t('stepOf', { n: step, of })}>
            {Array.from({ length: of }, (_, i) => (
              <i key={i} className={cx(i + 1 < step && g.done, i + 1 === step && g.now)} />
            ))}
          </div>
        )}
        <h1 id="gate-title">{title}</h1>
        <p className={g.lead}>{lead}</p>
        {children}
        {onCancel ? (
          <button type="button" className={g.linkBtn} onClick={onCancel}>
            {t('notNow')}
          </button>
        ) : (
          <button
            type="button"
            className={g.linkBtn}
            onClick={() => {
              void signOut().then(() => router.push('/sign-in'));
            }}
          >
            {t('signOut')}
          </button>
        )}
      </section>
    </div>
  );
}

function PasswordStep({ status, onDone }: { status: StaffSecurity; onDone: () => void }) {
  const t = useTranslations('admin.security');
  const { user } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const steps = status.mfaRequired && !status.enrolled ? 2 : 1;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffPasswordOk(next, user?.email ?? '')) return setErr(t('pwRulesNotMet'));
    setBusy(true);
    try {
      await securityApi.changePassword(current, next);
      onDone();
    } catch (x) {
      setErr(
        isApiError(x, 'INVALID_CREDENTIALS')
          ? t('pwCurrentWrong')
          : isApiError(x, 'VALIDATION_FAILED')
            ? t('pwRulesNotMet')
            : t('failed'),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame step={1} of={steps} title={t('pwTitle')} lead={t('pwLead')}>
      <form className={s.form} onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="pw-current">{t('pwCurrent')}</label>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className={s.field}>
          <label htmlFor="pw-new">{t('pwNew')}</label>
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setErr('');
            }}
          />
          <ul className={g.rules}>
            {STAFF_RULES.map(([k, ok]) => (
              <li key={k} className={cx(ok(next) && g.ok)}>
                <Ic name={ok(next) ? 'check' : 'minus'} size={14} />
                {t(`rule.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        {err && (
          <p className={g.err} role="alert">
            {err}
          </p>
        )}
        <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={busy || !current}>
          {t('pwSave')}
        </button>
      </form>
    </Frame>
  );
}

/** Turn on two-step sign-in: QR code and key, a first code, then the recovery codes. */
export function SetupStep({
  status,
  onDone,
  onCancel,
}: {
  status: StaffSecurity;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('admin.security');
  const [key, setKey] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const total = status.mustChangePassword ? 2 : 1;

  useEffect(() => {
    let live = true;
    securityApi
      .setup()
      .then((k) => live && setKey(k))
      .catch(() => live && setErr(t('failed')));
    return () => {
      live = false;
    };
  }, [t]);

  if (codes)
    return (
      <Frame step={total} of={total} title={t('codesTitle')} lead={t('codesLead')}>
        <RecoveryCodes codes={codes} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          {t('codesSaved')}
        </label>
        <button
          type="button"
          className={cx(s.btn, s.btnPrimary)}
          disabled={!saved}
          onClick={onDone}
        >
          {t('openConsole')}
        </button>
      </Frame>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setCodes((await securityApi.enable(code)).codes);
    } catch (x) {
      setErr(isApiError(x, 'MFA_CODE_INVALID') ? t('codeWrong') : t('failed'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      step={total}
      of={total}
      title={t('setupTitle')}
      lead={t('setupLead')}
      {...(onCancel ? { onCancel } : {})}
    >
      {key ? (
        <div className={g.qrRow}>
          <div className={g.qr}>
            <QrCode text={key.otpauthUri} label={t('qrLabel')} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <span className={g.small}>{t('setupManual')}</span>
            <code className={g.key} data-testid="mfa-secret">
              {key.secret.replace(/(.{4})/g, '$1 ').trim()}
            </code>
          </div>
        </div>
      ) : (
        !err && <div className={s.spin} aria-busy="true" />
      )}
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }} noValidate>
        <label htmlFor="mfa-code" className={s.lbl}>
          {t('codeLabel')}
        </label>
        <input
          id="mfa-code"
          className={g.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            setErr('');
          }}
        />
        {err && (
          <p className={g.err} role="alert">
            {err}
          </p>
        )}
        <button
          type="submit"
          className={cx(s.btn, s.btnPrimary)}
          disabled={busy || code.length !== 6 || !key}
        >
          {t('setupConfirm')}
        </button>
      </form>
    </Frame>
  );
}

function VerifyStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('admin.security');
  const { signOut } = useSession();
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await securityApi.verify(recovery ? { recoveryCode: value } : { code: value });
      onDone();
    } catch (x) {
      if (isApiError(x, 'MFA_LOCKED') || isApiError(x, 'UNAUTHORIZED')) {
        await signOut();
        router.push('/sign-in?locked=mfa');
        return;
      }
      const left = isApiError(x) ? x.meta<number>('attemptsLeft') : undefined;
      setErr(
        isApiError(x, 'MFA_CODE_INVALID')
          ? left !== undefined
            ? t('codeWrongLeft', { n: left })
            : t('codeWrong')
          : t('failed'),
      );
      setValue('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      step={1}
      of={1}
      title={t('verifyTitle')}
      lead={t(recovery ? 'recoveryLead' : 'verifyLead')}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }} noValidate>
        <label htmlFor="mfa-verify" className={s.lbl}>
          {t(recovery ? 'recoveryLabel' : 'codeLabel')}
        </label>
        <input
          id="mfa-verify"
          className={g.code}
          style={recovery ? { letterSpacing: '0.12em', fontSize: 20 } : undefined}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          maxLength={recovery ? 11 : 6}
          value={value}
          onChange={(e) => {
            setValue(
              recovery
                ? e.target.value.toUpperCase().slice(0, 11)
                : e.target.value.replace(/\D/g, '').slice(0, 6),
            );
            setErr('');
          }}
        />
        {err && (
          <p className={g.err} role="alert">
            {err}
          </p>
        )}
        <button
          type="submit"
          className={cx(s.btn, s.btnPrimary)}
          disabled={
            busy || (recovery ? value.replace(/[\s-]/g, '').length < 10 : value.length !== 6)
          }
        >
          {t('verifyConfirm')}
        </button>
      </form>
      <button
        type="button"
        className={g.linkBtn}
        onClick={() => {
          setRecovery((r) => !r);
          setValue('');
          setErr('');
        }}
      >
        {t(recovery ? 'useApp' : 'useRecovery')}
      </button>
    </Frame>
  );
}

/**
 * Stands between staff and the console until their session has done what the backend's
 * StaffGate asks: a forced password change, two-step sign-in set up, and this sign-in's code.
 * Re-checks when any console request is refused for one of those reasons (the check expires).
 */
export function StaffGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data, error, refetch } = useStaffSecurity();
  const done = () => void qc.invalidateQueries();

  // A console request refused by the gate (e.g. the 12-hour check ran out): ask again.
  useEffect(
    () =>
      qc.getQueryCache().subscribe((ev) => {
        const e = ev.query.state.error;
        if (ev.type === 'updated' && e && GATE_CODES.some((c) => isApiError(e, c)))
          void qc.invalidateQueries({ queryKey: securityKey(user?.id) });
      }),
    [qc, user?.id],
  );
  // Ask again when this sign-in's check runs out.
  useEffect(() => {
    if (!data?.verifiedUntil) return;
    const ms = Date.parse(data.verifiedUntil) - Date.now();
    if (ms <= 0 || ms > 2 ** 31 - 1) return;
    const id = setTimeout(() => void refetch(), ms + 1000);
    return () => clearTimeout(id);
  }, [data?.verifiedUntil, refetch]);

  if (!data) {
    if (error) return <>{children}</>; // the console shows its own error states
    return <div className={g.wrap} aria-busy="true" />;
  }
  if (data.mustChangePassword) return <PasswordStep status={data} onDone={done} />;
  if (data.mfaRequired && !data.enrolled) return <SetupStep status={data} onDone={done} />;
  // Required for everyone, or turned on by this person: this sign-in needs its code.
  if ((data.mfaRequired || data.enrolled) && !data.verified) return <VerifyStep onDone={done} />;
  return <>{children}</>;
}
