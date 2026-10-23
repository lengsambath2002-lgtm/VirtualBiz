'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { cn } from '@/lib/utils/cn';

import { firebaseCode, firebaseEnabled, googleIdToken } from '@/lib/firebase';

import { firebaseSignIn, googleDevSignIn, googleSignIn } from '../api';
import { useAuthPage, useFlowActions } from '../hooks/useFlowActions';
import { FIRST_STEP } from '../types';
import { emailOk, initials } from '../util/rules';
import { GOOGLE_CLIENT_ID, GoogleButton } from './GoogleButton';
import { GoogleIcon, SiIcon } from './icons';
import { Alert, Btn, Field, Sheet, Spinner } from './parts';
import s from './signIn.module.css';

/**
 * Google accounts the dev chooser lists ("signed in on this browser"): the seeded demo users.
 * Only used while no Google client id is configured (`/api/auth/google/dev`, local / dev only).
 */
const DEV_GOOGLE_ACCOUNTS = [
  { name: 'Kry Sonita', email: 'nita@virtualbiz.com' },
  { name: 'Dom Chheng', email: 'dom@virtualbiz.com' },
] as const;

/** Message for a failed Google sign-in. */
function useGoogleError() {
  const t = useTranslations('auth.google');
  const tc = useTranslations('common');
  return (e: unknown) =>
    isApiError(e, 'NOT_CONFIGURED', 'INVALID_TOKEN', 'NOT_FOUND')
      ? t('errUnavailable')
      : tc(fallbackErrorKey(e));
}

/**
 * "Choose an account — to continue to VirtualBiz", shown over the page's first step for
 * `?step=google`. With `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set it shows Google's own button
 * (`/api/auth/google` with the ID token). Without it, a dev chooser lists the demo accounts and
 * "Use another account" (`?step=google-new`) asks for a name and Gmail address
 * (`/api/auth/google/dev`).
 */
export function GoogleChooser({ mode }: { mode: 'list' | 'new' }) {
  const t = useTranslations('auth.google');
  const page = useAuthPage();
  const { go } = useFlowActions();
  const viaFirebase = firebaseEnabled();
  const real = viaFirebase || !!GOOGLE_CLIENT_ID;
  return (
    <Sheet label={t('title')} onClose={() => go(FIRST_STEP[page])}>
      <div className={s.gHead}>
        <GoogleIcon />
        <h2>{mode === 'list' || real ? t('title') : t('newTitle')}</h2>
        <p>{t('sub')}</p>
      </div>
      {viaFirebase ? <FirebaseGoogle /> : real ? <RealGoogle /> : mode === 'list' ? <AccountList /> : <NewAccount />}
    </Sheet>
  );
}

/** Firebase: Google's account chooser in a popup, then `/api/auth/firebase` (docs/ops/firebase.md). */
function FirebaseGoogle() {
  const locale = useLocale();
  const t = useTranslations('auth.google');
  const { signIn } = useFlowActions();
  const message = useGoogleError();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      signIn(await firebaseSignIn(await googleIdToken(locale)), 'google');
    } catch (e) {
      setBusy(false);
      const code = firebaseCode(e);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError(code === 'auth/popup-blocked' ? t('errPopup') : code ? t('errUnavailable') : message(e));
    }
  };

  return (
    <div className={s.form}>
      {error && <Alert kind="bad">{error}</Alert>}
      <Btn type="button" variant="ghost" onClick={start} busy={busy} busyLabel={t('signingIn')}>
        <GoogleIcon />
        {t('continue')}
      </Btn>
    </div>
  );
}

function RealGoogle() {
  const locale = useLocale();
  const t = useTranslations('auth.google');
  const { signIn } = useFlowActions();
  const message = useGoogleError();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={s.form}>
      {error && <Alert kind="bad">{error}</Alert>}
      {busy ? (
        <p className={s.small}>
          <Spinner />
          {t('signingIn')}
        </p>
      ) : (
        <GoogleButton
          locale={locale}
          onUnavailable={() => setError(t('errUnavailable'))}
          onCredential={async (idToken) => {
            setBusy(true);
            setError(null);
            try {
              signIn(await googleSignIn(idToken), 'google');
            } catch (e) {
              setBusy(false);
              setError(message(e));
            }
          }}
        />
      )}
    </div>
  );
}

function AccountList() {
  const t = useTranslations('auth.google');
  const { go, signIn } = useFlowActions();
  const message = useGoogleError();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (u: { name: string; email: string }) => {
    if (busy) return;
    setBusy(u.email);
    setError(null);
    try {
      signIn(await googleDevSignIn(u.email, u.name), 'google');
    } catch (e) {
      setBusy(null);
      setError(message(e));
    }
  };

  return (
    <>
      {error && <Alert kind="bad">{error}</Alert>}
      <ul className={s.gList}>
        {DEV_GOOGLE_ACCOUNTS.map((u) => (
          <li key={u.email}>
            <button type="button" className={s.gRow} disabled={!!busy} onClick={() => pick(u)}>
              <span className={s.gAv}>{initials(u.name)}</span>
              <span className={s.gTxt}>
                <strong>{u.name}</strong>
                <small>{u.email}</small>
              </span>
              {busy === u.email && <Spinner />}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={s.gRow}
            disabled={!!busy}
            onClick={() => go('google-new')}
          >
            <span className={cn(s.gAv, s.gAvOther)}>
              <SiIcon name="user" size={18} />
            </span>
            <span className={s.gTxt}>
              <strong>{t('another')}</strong>
            </span>
          </button>
        </li>
      </ul>
    </>
  );
}

function NewAccount() {
  const t = useTranslations('auth.google');
  const { go, signIn } = useFlowActions();
  const message = useGoogleError();
  const [failed, setFailed] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errName, setErrName] = useState<string | null>(null);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const v = email.trim().toLowerCase();
    const en = n.length < 2 ? t('errName') : null;
    const ee = !emailOk(v) ? t('errEmail') : null;
    setErrName(en);
    setErrEmail(ee);
    if (en || ee) return (en ? nameRef : emailRef).current?.focus();
    setBusy(true);
    setFailed(null);
    try {
      signIn(await googleDevSignIn(v, n), 'google');
    } catch (err) {
      setBusy(false);
      setFailed(message(err));
    }
  };

  return (
    <form className={s.form} noValidate onSubmit={onSubmit}>
      {failed && <Alert kind="bad">{failed}</Alert>}
      <Field
        id="g-name"
        label={t('name')}
        error={errName}
        input={{
          ref: nameRef,
          autoComplete: 'name',
          placeholder: t('namePlaceholder'),
          value: name,
          onChange: (e) => {
            setName(e.target.value);
            if (errName) setErrName(null);
          },
        }}
      />
      <Field
        id="g-email"
        label={t('email')}
        error={errEmail}
        input={{
          ref: emailRef,
          type: 'email',
          autoComplete: 'email',
          autoCapitalize: 'none',
          spellCheck: false,
          placeholder: t('emailPlaceholder'),
          value: email,
          onChange: (e) => {
            setEmail(e.target.value);
            if (errEmail) setErrEmail(null);
          },
        }}
      />
      <div className={s.modalBtns}>
        <Btn type="button" variant="ghost" onClick={() => go('google')}>
          {t('back')}
        </Btn>
        <Btn type="submit" busy={busy} busyLabel={t('signingIn')}>
          {t('continue')}
        </Btn>
      </div>
    </form>
  );
}
