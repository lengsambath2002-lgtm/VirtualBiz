'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { fallbackErrorKey, isApiError, metaNumber } from '@/lib/api';
import { formatPhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';

import { loginWithCode, verifyPhone, verifyReset, verifySignup } from '../api';
import { useFlowActions } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import type { CodePurpose, OtpState, Step } from '../types';
import { CODE_LENGTH } from '../util/rules';
import { GoogleIcon, SiIcon } from './icons';
import { BackLink, Btn, ErrorLine, useShellElement } from './parts';
import s from './signIn.module.css';

const TITLE = {
  verify: 'titleVerify',
  login: 'titleLogin',
  reset: 'titleReset',
  phone: 'titlePhone',
} as const satisfies Record<CodePurpose, string>;
const BACK_TO: Record<CodePurpose, Step> = {
  verify: 'signup',
  login: 'login',
  reset: 'login',
  phone: 'phone',
};
const EMPTY = Array.from({ length: CODE_LENGTH }, () => '');

/**
 * The shared 6-digit code step: verify a sign-up, log in by email code, reset a password, or
 * confirm a phone. Codes last 10 minutes, resend unlocks after 30 s, 5 wrong codes kill a code.
 */
export function CodeStep({ otp }: { otp: OtpState }) {
  const t = useTranslations('auth.code');
  const tc = useTranslations('common');
  const { go, startCode, signIn } = useFlowActions();
  const isEmail = otp.purpose !== 'phone';
  const label = otp.purpose === 'reset' ? t('continue') : t('verify');

  const [digits, setDigits] = useState<string[]>(EMPTY);
  const digitsRef = useRef<string[]>(EMPTY);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Fresh screen for every code sent (first render and each resend).
  useEffect(() => {
    digitsRef.current = EMPTY;
    setDigits(EMPTY);
    setError(null);
    setResending(false);
    const id = setTimeout(() => boxes.current[0]?.focus(), 0);
    return () => clearTimeout(id);
  }, [otp.seq]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    const o = useFlowStore.getState().otp;
    if (!o) return;
    checkingRef.current = true;
    setChecking(true);
    const code = digitsRef.current.join('');
    const fail = (m: string) => {
      checkingRef.current = false;
      setChecking(false);
      setError(m);
      setShake(true);
      setTimeout(() => setShake(false), 300);
      digitsRef.current = EMPTY;
      setDigits(EMPTY);
      boxes.current[0]?.focus();
    };
    const f = useFlowStore.getState();
    try {
      if (o.purpose === 'verify') {
        signIn(await verifySignup(o.to, code), 'signup');
      } else if (o.purpose === 'login') {
        signIn(await loginWithCode(o.to, code), 'emailCode');
      } else if (o.purpose === 'reset') {
        const { resetToken } = await verifyReset(o.to, code);
        f.patch({ codeToast: false, verified: 'reset', resetToken });
        go('new-password');
      } else {
        const res = await verifyPhone(o.to, code);
        if (res.status === 'SIGNED_IN') signIn(res.session, 'phone');
        else {
          f.patch({ codeToast: false, verified: 'phone', phoneToken: res.phoneToken });
          go('phone-name');
        }
      }
    } catch (err) {
      if (isApiError(err, 'OTP_EXPIRED')) return fail(t('errExpired'));
      if (isApiError(err, 'OTP_ATTEMPTS_EXCEEDED')) return fail(t('errTooMany'));
      if (isApiError(err, 'OTP_INVALID')) {
        const left = metaNumber(err, 'triesLeft', 0);
        return fail(left > 0 ? t('errWrong', { left }) : t('errTooMany'));
      }
      return fail(tc(fallbackErrorKey(err)));
    }
  }, [t, tc, go, signIn]);

  const commit = (next: string[], focus: number) => {
    digitsRef.current = next;
    setDigits(next);
    setError(null);
    boxes.current[Math.min(focus, CODE_LENGTH - 1)]?.focus();
    if (next.join('').length === CODE_LENGTH) void check();
  };
  const fill = (i: number, d: string) => {
    const next = [...digitsRef.current];
    [...d].forEach((c, k) => {
      if (i + k < CODE_LENGTH) next[i + k] = c;
    });
    commit(next, i + d.length);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (digitsRef.current.join('').length === CODE_LENGTH) void check();
  };

  const resendLeft = Math.ceil((otp.resendAt - now) / 1000);
  const shell = useShellElement();
  const showToast = useFlowStore((st) => st.codeToast);
  const complete = digits.join('').length === CODE_LENGTH;

  const box = (i: number) => (
    <input
      key={i}
      ref={(el) => {
        boxes.current[i] = el;
      }}
      inputMode="numeric"
      maxLength={1}
      autoComplete={i ? 'off' : 'one-time-code'}
      aria-label={t('digit', { n: i + 1 })}
      value={digits[i] ?? ''}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '');
        if (d) fill(i, d.slice(0, CODE_LENGTH - i));
        else {
          const next = [...digitsRef.current];
          next[i] = '';
          commit(next, i);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' && !digitsRef.current[i] && i) {
          e.preventDefault();
          const next = [...digitsRef.current];
          next[i - 1] = '';
          commit(next, i - 1);
        }
        if (e.key === 'ArrowLeft' && i) boxes.current[i - 1]?.focus();
        if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
      }}
      onPaste={(e) => {
        e.preventDefault();
        const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, CODE_LENGTH);
        if (!d) return;
        digitsRef.current = EMPTY;
        fill(0, d);
      }}
      onFocus={(e) => e.target.select()}
    />
  );

  const dest = isEmail ? otp.to : `+855 ${formatPhone(otp.to).slice(1)}`;
  const resendBtn = (chunks: ReactNode) => (
    <button
      type="button"
      className={s.link}
      disabled={resendLeft > 0 || resending}
      onClick={async () => {
        setResending(true);
        setError(null);
        try {
          await startCode(otp.purpose, otp.to);
        } catch (err) {
          setResending(false);
          if (isApiError(err, 'OTP_RESEND_TOO_SOON')) {
            // The server's clock wins: restart the countdown from its retryAfter.
            const secs = metaNumber(err, 'retryAfter', 30);
            const cur = useFlowStore.getState().otp;
            if (cur)
              useFlowStore
                .getState()
                .patch({ otp: { ...cur, resendAt: Date.now() + secs * 1000 } });
            setError(t('errResendSoon', { seconds: secs }));
          } else setError(tc(fallbackErrorKey(err)));
        }
      }}
    >
      {chunks}
    </button>
  );

  return (
    <>
      <BackLink to={BACK_TO[otp.purpose]} />
      <div>
        <h1>{t(TITLE[otp.purpose])}</h1>
        <p className={s.sub}>
          {t.rich('sub', {
            to: dest,
            b: (c) => <b className={isEmail ? undefined : 'num'}>{c}</b>,
          })}
        </p>
      </div>
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <div className={cn(s.otp, shake && s.shake)} role="group" aria-label={t('group')}>
          {[0, 1, 2].map(box)}
          <i aria-hidden="true" />
          {[3, 4, 5].map(box)}
        </div>
        <ErrorLine id="e-otp" message={error} />
        <Btn type="submit" busy={checking} busyLabel={t('checking')} disabled={!complete}>
          {label}
        </Btn>
      </form>
      {isEmail && (
        <div className={s.mailers}>
          <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">
            <GoogleIcon />
            {t('openGmail')}
          </a>
          <a href="https://outlook.live.com/mail/" target="_blank" rel="noopener noreferrer">
            <SiIcon name="mail" />
            {t('openOutlook')}
          </a>
        </div>
      )}
      <p className={s.small}>
        {t.rich(isEmail ? 'didntGetEmail' : 'didntGetSms', { resend: resendBtn })}{' '}
        <span className="num">
          {resendLeft > 0
            ? t('resendIn', { time: `0:${String(resendLeft).padStart(2, '0')}` })
            : ''}
        </span>
      </p>
      {showToast &&
        otp.devCode &&
        shell &&
        createPortal(
          <CodeToast
            code={otp.devCode}
            via={isEmail ? t('toastEmail') : t('toastSms')}
            onFill={() => {
              if (!otp.devCode) return;
              digitsRef.current = EMPTY;
              fill(0, otp.devCode);
            }}
          />,
          shell,
        )}
    </>
  );
}

/**
 * Dev code delivery: local / dev API profiles have no email/SMS gateway and return the code as
 * `devCode`, shown in this toast (as in the prototype) with "Fill in" to type it for you.
 * Production never sends `devCode`, so the toast never shows there.
 */
function CodeToast({ code, via, onFill }: { code: string; via: string; onFill: () => void }) {
  const t = useTranslations('auth.code');
  return (
    <div className={s.codeToast} role="status">
      <div>
        <small>{via}</small>
        {t.rich('toastCode', { code, b: (c) => <b>{c}</b> })}
      </div>
      <button type="button" onClick={onFill}>
        {t('fillIn')}
      </button>
    </div>
  );
}
