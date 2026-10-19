'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { useFlowActions, usePageHref } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import { containsEmailName, emailOk, passwordOk } from '../util/rules';
import { GoogleIcon, SiIcon } from './icons';
import { Alert, AltLine, Btn, EmailField, Field, OrDivider, RulesList, StepLink } from './parts';
import s from './signIn.module.css';

/**
 * "Create your account" (/sign-up): Google, phone, or name + email + password (4 rules, must not
 * contain the email name), then verify the email with a code.
 */
export function SignupStep({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('auth.signup');
  const te = useTranslations('auth.email');
  const tc = useTranslations('common');
  const { go, startCode } = useFlowActions();
  const pageHref = usePageHref();
  const [name, setName] = useState(() => useFlowStore.getState().pending?.name ?? '');
  const [email, setEmail] = useState(initialEmail);
  const [pw, setPw] = useState('');
  const [errName, setErrName] = useState<string | null>(null);
  const [errEmail, setErrEmail] = useState<ReactNode>(null);
  const [errPw, setErrPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const v = email.trim().toLowerCase();
    const en = n.length < 2 ? t('errName') : null;
    const ee = !v ? te('errEmpty') : !emailOk(v) ? te('errInvalid') : null;
    const ep = !pw
      ? t('errPwEmpty')
      : !passwordOk(pw)
        ? t('errPwRules')
        : v && containsEmailName(pw, v)
          ? t('errPwEmail')
          : null;
    setErrName(en);
    setErrEmail(ee);
    setErrPw(ep);
    if (en || ee || ep) return (en ? nameRef : ee ? emailRef : pwRef).current?.focus();
    setBusy(true);
    setFailed(null);
    // `/auth/signup` stores the pending sign-up and sends the code (see startCode).
    useFlowStore.getState().patch({ email: v, pending: { name: n, email: v, password: pw } });
    try {
      await startCode('verify', v);
    } catch (err) {
      setBusy(false);
      if (isApiError(err, 'CONFLICT')) {
        useFlowStore.getState().patch({ pending: null });
        setErrEmail(
          t.rich('errTaken', {
            link: (c) => (
              <Link className={cn(s.link, s.inheritLink)} href={pageHref('sign-in', v)}>
                {c}
              </Link>
            ),
          }),
        );
        return emailRef.current?.focus();
      }
      if (isApiError(err, 'VALIDATION_FAILED')) {
        const bad = (f: string) => err.details.some((d) => d.field === f);
        if (bad('name')) setErrName(t('errName'));
        if (bad('email')) setErrEmail(te('errInvalid'));
        if (bad('password')) setErrPw(t('errPwRules'));
        if (bad('name') || bad('email') || bad('password')) return;
      }
      setFailed(tc(fallbackErrorKey(err)));
      return;
    }
    go('verify');
  };

  return (
    <>
      <div>
        <h1>{t('title')}</h1>
        <p className={s.sub}>{t('sub')}</p>
      </div>
      <div className={s.stack}>
        <Btn variant="ghost" onClick={() => go('google')}>
          <GoogleIcon />
          {t('google')}
        </Btn>
        <Btn variant="ghost" onClick={() => go('phone')}>
          <SiIcon name="phone" />
          {t('phone')}
        </Btn>
      </div>
      <OrDivider />
      {failed && <Alert kind="bad">{failed}</Alert>}
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <Field
          id="name"
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
        <EmailField
          value={email}
          autoComplete="email"
          onChange={(v) => {
            setEmail(v);
            useFlowStore.getState().patch({ email: v.trim().toLowerCase() });
            if (errEmail) setErrEmail(null);
          }}
          error={errEmail}
          inputRef={emailRef}
        />
        <Field
          id="pw"
          label={t('password')}
          password
          error={errPw}
          after={<RulesList value={pw} />}
          input={{
            ref: pwRef,
            autoComplete: 'new-password',
            value: pw,
            onChange: (e) => {
              setPw(e.target.value);
              if (errPw) setErrPw(null);
            },
          }}
        />
        <Btn type="submit" busy={busy} busyLabel={t('creating')}>
          {t('create')}
        </Btn>
      </form>
      <p className={s.small}>
        {t.rich('legal', {
          terms: (c) => <StepLink step="terms">{c}</StepLink>,
          privacy: (c) => <StepLink step="privacy">{c}</StepLink>,
        })}
      </p>
      <AltLine>
        {t.rich('haveAccount', {
          link: (c) => <Link href={pageHref('sign-in', email.trim().toLowerCase())}>{c}</Link>,
        })}
      </AltLine>
    </>
  );
}
