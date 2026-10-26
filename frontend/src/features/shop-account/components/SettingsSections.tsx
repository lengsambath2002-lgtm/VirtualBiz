'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { QrCode } from '@/components/ui';
import { fallbackErrorKey, isApiError, type NotifyTopic, type Prefs } from '@/lib/api';
import { useTheme, type ThemePref } from '@/lib/theme';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import s from '@/features/shop-shared/shop.module.css';
import { toast } from '@/features/shop-shared/store';

import { useTwoStep, useTwoStepActions } from '../queries';
import a from './account.module.css';

const MINE: NotifyTopic[] = ['ORDERS', 'BOOKINGS'];
const SHOPS: NotifyTopic[] = ['SHOP_ACTIVITY', 'STOCK', 'REVIEWS', 'ACCOUNT'];

/**
 * Which notifications also come by email and by push, per topic (docs/ops/email.md § Choices).
 * Shop topics show for people with a shop. The in-app inbox always gets everything.
 */
export function NotifyChoices({
  prefs,
  hasEmail,
  hasShops,
  onChange,
}: {
  prefs: Prefs | undefined;
  hasEmail: boolean;
  hasShops: boolean;
  onChange: (topic: NotifyTopic, channel: 'email' | 'push', on: boolean) => void;
}) {
  const t = useTranslations('shop.account.notify');
  // Flipped in the click itself; the saved prefs take over when they arrive (or roll back).
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  useEffect(() => setFlipped({}), [prefs]);
  const group = (title: string, topics: NotifyTopic[]) => (
    <tbody>
      <tr>
        <th scope="rowgroup" colSpan={3} className={a.ntGroup}>
          {title}
        </th>
      </tr>
      {topics.map((topic) => {
        const ch = prefs?.topics[topic];
        return (
          <tr key={topic}>
            <th scope="row">
              {t(`topic.${topic}`)}
              <small>{t(`topicHint.${topic}`)}</small>
            </th>
            {(['email', 'push'] as const).map((c) => (
              <td key={c}>
                <input
                  type="checkbox"
                  className={a.switch}
                  aria-label={t('switchLabel', {
                    channel: t(c),
                    topic: t(`topic.${topic}`),
                  })}
                  checked={flipped[`${topic}.${c}`] ?? ch?.[c] ?? true}
                  disabled={!prefs || (c === 'email' && !hasEmail)}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setFlipped((f) => ({ ...f, [`${topic}.${c}`]: on }));
                    onChange(topic, c, on);
                  }}
                />
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
  return (
    <div className={a.nt}>
      <table>
        <thead>
          <tr>
            <td />
            <th scope="col">{t('email')}</th>
            <th scope="col">{t('push')}</th>
          </tr>
        </thead>
        {group(t('mine'), MINE)}
        {hasShops && group(t('shops'), SHOPS)}
      </table>
      <p className={a.ntNote}>{hasEmail ? t('inboxNote') : t('noEmail')}</p>
    </div>
  );
}

/** Light, dark or the device's setting; kept in this browser. */
export function AppearancePanel() {
  const t = useTranslations('shop.account.appearance');
  const [theme, setTheme] = useTheme();
  const opts: { v: ThemePref; icon: 'sun' | 'moon' | 'phone' }[] = [
    { v: 'system', icon: 'phone' },
    { v: 'light', icon: 'sun' },
    { v: 'dark', icon: 'moon' },
  ];
  return (
    <section className={cn(a.card, a.panel)}>
      <div className={a.panelH}>
        <div>
          <h2>{t('title')}</h2>
          <p>{t('hint')}</p>
        </div>
      </div>
      <div className={a.seg} role="radiogroup" aria-label={t('title')}>
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={theme === o.v}
            onClick={() => setTheme(o.v)}
          >
            <Ic name={o.icon} size={18} />
            {t(o.v)}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Recovery codes, shown once: copy, download, and confirm they're saved. */
function NewCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations('shop.account.twoStep');
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');
  return (
    <div className={a.tsBox}>
      <strong>{t('codesTitle')}</strong>
      <p>{t('codesLead')}</p>
      <div className={a.tsCodes} data-testid="recovery-codes">
        {codes.map((c) => (
          <code key={c}>{c}</code>
        ))}
      </div>
      <div className={a.formF} style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className={cn(s.btn, s.btnGhost, s.btnSm)}
          onClick={() => void navigator.clipboard?.writeText(text).then(() => toast(t('copied')))}
        >
          {t('copy')}
        </button>
        <a
          className={cn(s.btn, s.btnGhost, s.btnSm)}
          download="virtualbiz-recovery-codes.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`VirtualBiz recovery codes\n\n${text}\n`)}`}
        >
          {t('download')}
        </a>
      </div>
      <label className={a.tsCheck}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        {t('codesSaved')}
      </label>
      <div className={a.formF}>
        <button
          type="button"
          className={cn(s.btn, s.btnPrimary, s.btnSm)}
          disabled={!saved}
          onClick={onDone}
        >
          {t('done')}
        </button>
      </div>
    </div>
  );
}

/** Asks for a code from the app (or, where allowed, a recovery code) before a change. */
function CodeForm({
  label,
  submit,
  allowRecovery,
  onCancel,
  danger,
}: {
  label: string;
  submit: (v: { code: string } | { recoveryCode: string }) => Promise<void>;
  allowRecovery?: boolean;
  onCancel: () => void;
  danger?: boolean;
}) {
  const t = useTranslations('shop.account.twoStep');
  const tc = useTranslations('common');
  const [recovery, setRecovery] = useState(false);
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = recovery ? v.trim() : v.replace(/\D/g, '');
    if (recovery ? value.length < 10 : value.length !== 6) return setErr(t('errCode'));
    setBusy(true);
    try {
      await submit(recovery ? { recoveryCode: value } : { code: value });
    } catch (x) {
      setErr(isApiError(x, 'MFA_CODE_INVALID') ? t('errWrong') : tc(fallbackErrorKey(x)));
      setV('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={a.pwForm} noValidate onSubmit={onSubmit}>
      <label htmlFor="ts-code" className={a.tsLabel}>
        {recovery ? t('recoveryLabel') : t('codeLabel')}
      </label>
      <input
        id="ts-code"
        className={a.tsInput}
        value={v}
        autoFocus
        aria-invalid={!!err}
        aria-describedby={err ? 'ts-err' : undefined}
        {...(recovery
          ? { autoComplete: 'off', autoCapitalize: 'characters', spellCheck: false }
          : { inputMode: 'numeric' as const, autoComplete: 'one-time-code', maxLength: 6 })}
        onChange={(e) => {
          setV(e.target.value);
          setErr(null);
        }}
      />
      {err && (
        <p id="ts-err" className={a.tsErr} role="alert">
          {err}
        </p>
      )}
      {allowRecovery && (
        <button
          type="button"
          className={cn(s.link, a.tsSwitch)}
          onClick={() => {
            setRecovery((r) => !r);
            setV('');
            setErr(null);
          }}
        >
          {recovery ? t('useApp') : t('useRecovery')}
        </button>
      )}
      <div className={a.formF}>
        <button type="button" className={cn(s.btn, s.btnGhost, s.btnSm)} onClick={onCancel}>
          {t('cancel')}
        </button>
        <button
          className={cn(s.btn, s.btnSm, danger ? s.btnGhost : s.btnPrimary)}
          style={danger ? { color: 'var(--sale)' } : undefined}
          disabled={busy}
        >
          {label}
        </button>
      </div>
    </form>
  );
}

/** Two-step sign-in: turn on with an authenticator app, new recovery codes, turn off. */
export function TwoStepPanel() {
  const t = useTranslations('shop.account.twoStep');
  const tc = useTranslations('common');
  const status = useTwoStep();
  const act = useTwoStepActions();
  const [mode, setMode] = useState<'idle' | 'setup' | 'off' | 'renew'>('idle');
  const [key, setKey] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const st = status.data;
  const startSetup = async () => {
    try {
      setKey(await act.setup());
      setMode('setup');
    } catch (e) {
      toast(tc(fallbackErrorKey(e)));
    }
  };

  let body;
  if (status.error) {
    body = (
      <p className={a.ntNote}>
        {tc(fallbackErrorKey(status.error))}{' '}
        <button type="button" className={s.link} onClick={() => void status.refetch()}>
          {tc('feedback.retry')}
        </button>
      </p>
    );
  } else if (!st) {
    body = <div className={a.tsSkel} aria-busy="true" />;
  } else if (codes) {
    body = (
      <NewCodes
        codes={codes}
        onDone={() => {
          setCodes(null);
          setMode('idle');
        }}
      />
    );
  } else if (st.managedInConsole) {
    body = <p className={a.ntNote}>{t('staff')}</p>;
  } else if (mode === 'setup' && key) {
    body = (
      <div className={a.tsBox}>
        <ol className={a.tsSteps}>
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
        </ol>
        <div className={a.tsQr}>
          <div className={a.tsQrImg}>
            <QrCode text={key.otpauthUri} label={t('qrLabel')} />
          </div>
          <div>
            <small>{t('manual')}</small>
            <code data-testid="two-step-secret">{key.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </div>
        </div>
        <CodeForm
          label={t('turnOn')}
          onCancel={() => setMode('idle')}
          submit={async (v) => {
            if (!('code' in v)) return;
            setCodes(await act.enable(v.code));
            toast(t('onToast'));
          }}
        />
      </div>
    );
  } else if (mode === 'off') {
    body = (
      <CodeForm
        label={t('turnOff')}
        danger
        allowRecovery
        onCancel={() => setMode('idle')}
        submit={async (v) => {
          await act.disable(v);
          setMode('idle');
          toast(t('offToast'));
        }}
      />
    );
  } else if (mode === 'renew') {
    body = (
      <CodeForm
        label={t('newCodes')}
        onCancel={() => setMode('idle')}
        submit={async (v) => {
          if ('code' in v) setCodes(await act.newCodes(v.code));
        }}
      />
    );
  } else {
    body = (
      <div className={a.kvRow}>
        <span>{t('status')}</span>
        <span>
          {st.enabled ? (
            <>
              <b className={a.tsOn}>
                <Ic name="check" size={14} /> {t('on')}
              </b>{' '}
              <small className={s.muted}>{t('left', { n: st.recoveryCodesLeft })}</small>
            </>
          ) : (
            <span className={s.muted}>{t('off')}</span>
          )}
        </span>
        <span className={a.tsActions}>
          {st.enabled ? (
            <>
              <button
                type="button"
                className={cn(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => setMode('renew')}
              >
                {t('newCodes')}
              </button>
              <button
                type="button"
                className={cn(s.btn, s.btnGhost, s.btnSm)}
                style={{ color: 'var(--sale)' }}
                onClick={() => setMode('off')}
              >
                {t('turnOff')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={cn(s.btn, s.btnPrimary, s.btnSm)}
              onClick={() => void startSetup()}
            >
              {t('turnOn')}
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <section className={cn(a.card, a.panel)} aria-labelledby="two-step-h">
      <div className={a.panelH}>
        <div>
          <h2 id="two-step-h">{t('title')}</h2>
          <p>{t('hint')}</p>
        </div>
      </div>
      {body}
    </section>
  );
}
