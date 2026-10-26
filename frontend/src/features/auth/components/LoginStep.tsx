'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { fallbackErrorKey, isApiError, metaNumber } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { passwordSignIn } from '../util/passwordSignIn';
import { useFlowActions, usePageHref } from '../hooks/useFlowActions';
import { useSignInMethods } from '../hooks/useSignInMethods';
import { useFlowStore } from '../store';
import { emailOk, LOCK_MS } from '../util/rules';
import { GoogleStart } from './GoogleChooser';
import { SiIcon } from './icons';
import { Alert, AltLine, Btn, EmailField, Field, OrDivider, Spinner } from './parts';
import s from './signIn.module.css';

type Sending = 'forgot' | 'code' | 'inline' | null;

/**
 * "Log in" (/sign-in): Google, phone, or email + password on one screen. 5 wrong passwords lock
 * the form for 30 s; logging in by email code stays open.
 */
export function LoginStep({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('auth.login');
  const methods = useSignInMethods();
  const te = useTranslations('auth.email');
  const tu = useTranslations('auth.ui');
  const tc = useTranslations('common');
  const { go, startCode, signIn, askTwoStep } = useFlowActions();
  const pageHref = usePageHref();
  const lockUntil = useFlowStore((st) => st.lockUntil);
  const [email, setEmail] = useState(initialEmail);
  const [pw, setPw] = useState('');
  const [errEmail, setErrEmail] = useState<ReactNode>(null);
  const [errPw, setErrPw] = useState<string | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  // The account has no password (it signs in with a code, Google or SMS).
  const [noPassword, setNoPassword] = useState(false);
  /** A failure that is not about a field (offline, server error). */
  const [failed, setFailed] = useState<string | null>(null);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Sending>(null);
  const [now, setNow] = useState(() => Date.now());
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const lockLeft = Math.ceil((lockUntil - now) / 1000);
  const locked = lockLeft > 0;

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockUntil) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  // The lock alert replaces the wrong-password alert; when the lock ends both are gone.
  useEffect(() => {
    if (locked) setWrong(null);
  }, [locked]);

  const changeEmail = (v: string) => {
    setEmail(v);
    useFlowStore.getState().patch({ email: v.trim().toLowerCase() });
    if (errEmail) setErrEmail(null);
    if (wrong !== null) setWrong(null);
    if (failed) setFailed(null);
  };

  /** "No account uses this email. Create an account" (carrying the email to /sign-up). */
  const noAccount = (v: string) =>
    t.rich('errNoAccount', {
      link: (c) => (
        <Link className={cn(s.link, s.inheritLink)} href={pageHref('sign-up', v)}>
          {c}
        </Link>
      ),
    });

  /** Validate the email field; returns the normalized email, or null after showing the error. */
  const checkEmail = (): string | null => {
    const v = email.trim().toLowerCase();
    const err = !v ? te('errEmpty') : !emailOk(v) ? te('errInvalid') : null;
    setErrEmail(err);
    if (err) {
      emailRef.current?.focus();
      return null;
    }
    return v;
  };

  /** Email a code (login or password reset) to a known account. */
  const sendCode = async (purpose: 'login' | 'reset', via: Exclude<Sending, null>) => {
    const v = checkEmail();
    if (!v) return;
    setSending(via);
    setFailed(null);
    const step = purpose === 'login' ? 'email-code' : 'reset-code';
    useFlowStore.getState().patch({ email: v });
    try {
      await startCode(purpose, v);
    } catch (err) {
      setSending(null);
      if (isApiError(err, 'USER_NOT_FOUND')) {
        setErrEmail(noAccount(v));
        return emailRef.current?.focus();
      }
      // Asked again within 30 s: the code already sent still works.
      const otp = useFlowStore.getState().otp;
      if (isApiError(err, 'OTP_RESEND_TOO_SOON') && otp?.purpose === purpose && otp.to === v)
        return go(step);
      setFailed(
        isApiError(err, 'OTP_RESEND_TOO_SOON')
          ? t('waitForCode', { seconds: metaNumber(err, 'retryAfter', 30) })
          : tc(fallbackErrorKey(err)),
      );
      return;
    }
    go(step);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const v = checkEmail();
    if (!v) return;
    if (!pw) {
      setErrPw(t('errPwEmpty'));
      return pwRef.current?.focus();
    }
    setWrong(null);
    setNoPassword(false);
    setFailed(null);
    setBusy(true);
    try {
      const session = await passwordSignIn(v, pw);
      useFlowStore.getState().patch({ email: v });
      signIn(session, 'password');
    } catch (err) {
      setBusy(false);
      if (askTwoStep(err, 'password')) {
        useFlowStore.getState().patch({ email: v });
        return;
      }
      if (isApiError(err, 'ACCOUNT_LOCKED')) {
        const secs = metaNumber(err, 'retryAfter', LOCK_MS / 1000);
        useFlowStore.getState().patch({ lockUntil: Date.now() + secs * 1000 });
        return;
      }
      if (!isApiError(err, 'INVALID_CREDENTIALS')) {
        setFailed(tc(fallbackErrorKey(err)));
        return;
      }
      if (err.meta('reason') === 'NO_ACCOUNT') {
        setErrEmail(noAccount(v));
        return emailRef.current?.focus();
      }
      if (err.meta('reason') === 'NO_PASSWORD') {
        setNoPassword(true);
        return;
      }
      const left = metaNumber(err, 'triesLeft', 0);
      if (left <= 0) {
        useFlowStore.getState().patch({ lockUntil: Date.now() + LOCK_MS });
        return;
      }
      setWrong(left);
      pwRef.current?.select();
    }
  };

  let alert: ReactNode = null;
  if (failed && !locked) alert = <Alert kind="bad">{failed}</Alert>;
  else if (locked)
    alert = (
      <Alert kind="bad">
        {t.rich('locked', {
          seconds: lockLeft,
          num: (c) => <span className="num">{c}</span>,
        })}
      </Alert>
    );
  else if (noPassword)
    alert = (
      <Alert kind="ok">
        {t('noPassword')}{' '}
        <button
          type="button"
          className={cn(s.link, s.inheritLink)}
          disabled={sending === 'inline'}
          onClick={() => sendCode('login', 'inline')}
        >
          {sending === 'inline' ? t('sending') : t('emailMeCode')}
        </button>
        {' · '}
        <button
          type="button"
          className={cn(s.link, s.inheritLink)}
          disabled={sending === 'forgot'}
          onClick={() => sendCode('reset', 'forgot')}
        >
          {sending === 'forgot' ? t('sendingCode') : t('setPassword')}
        </button>
      </Alert>
    );
  else if (wrong !== null)
    alert = (
      <Alert kind="bad">
        {t('wrong')} {wrong <= 2 ? `${t('triesLeft', { left: wrong })} ` : ''}
        <button
          type="button"
          className={cn(s.link, s.inheritLink)}
          disabled={sending === 'inline'}
          onClick={() => sendCode('login', 'inline')}
        >
          {sending === 'inline' ? (
            <>
              <Spinner />
              {t('sending')}
            </>
          ) : (
            t('useCode')
          )}
        </button>
      </Alert>
    );

  return (
    <>
      <div>
        <h1>{t('title')}</h1>
        <p className={s.sub}>{t('sub')}</p>
      </div>
      <div className={s.stack}>
        <GoogleStart label={t('google')} onError={setFailed} />
        {methods.phone && (
          <Btn variant="ghost" onClick={() => go('phone')}>
            <SiIcon name="phone" />
            {t('phone')}
          </Btn>
        )}
      </div>
      <OrDivider />
      {alert}
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <EmailField value={email} onChange={changeEmail} error={errEmail} inputRef={emailRef} />
        <Field
          id="pw"
          label={t('password')}
          password
          error={errPw}
          right={
            <button
              type="button"
              className={cn(s.link, s.quiet, s.labelLink)}
              disabled={sending === 'forgot'}
              onClick={() => sendCode('reset', 'forgot')}
            >
              {sending === 'forgot' ? t('sendingCode') : t('forgot')}
            </button>
          }
          after={caps ? <div className={s.hint}>{tu('capsLock')}</div> : null}
          input={{
            ref: pwRef,
            autoComplete: 'current-password',
            value: pw,
            onChange: (e) => {
              setPw(e.target.value);
              if (errPw) setErrPw(null);
            },
            onKeyUp: (e) => setCaps(e.getModifierState?.('CapsLock') ?? false),
          }}
        />
        <Btn type="submit" busy={busy} busyLabel={t('loggingIn')} disabled={locked}>
          {locked ? t('tryAgainIn', { seconds: lockLeft }) : t('logIn')}
        </Btn>
      </form>
      <button
        type="button"
        className={cn(s.link, s.quiet, s.centerLink)}
        disabled={sending === 'code'}
        onClick={() => sendCode('login', 'code')}
      >
        {sending === 'code' ? (
          <>
            <Spinner />
            {t('sending')}
          </>
        ) : (
          t('codeLogin')
        )}
      </button>
      <AltLine>
        {t.rich('newHere', {
          link: (c) => <Link href={pageHref('sign-up', email.trim().toLowerCase())}>{c}</Link>,
        })}
      </AltLine>
    </>
  );
}
