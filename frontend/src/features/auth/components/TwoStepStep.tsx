'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import { fallbackErrorKey, isApiError, metaNumber } from '@/lib/api';

import { twoStepSignIn } from '../api';
import { useAuthPage, useFlowActions } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import { FIRST_STEP } from '../types';
import { Alert, BackLink, Btn, Field } from './parts';
import s from './signIn.module.css';

/**
 * Two-step sign-in (docs/api/two-step.md): the password, code or Google was right, and the account
 * also asks for a code from the authenticator app, or one of its recovery codes.
 */
export function TwoStepStep() {
  const t = useTranslations('auth.twoStep');
  const tc = useTranslations('common');
  const page = useAuthPage();
  const { signIn, go } = useFlowActions();
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const pending = useFlowStore.getState().twoStep;
    const v = recovery ? value.trim() : value.replace(/\D/g, '');
    const err = recovery
      ? v.length < 10
        ? t('errRecovery')
        : null
      : v.length !== 6
        ? t('errDigits')
        : null;
    setError(err);
    if (err || !pending) return input.current?.focus();
    setBusy(true);
    try {
      const session = await twoStepSignIn(
        pending.ticket,
        recovery ? { recoveryCode: v } : { code: v },
      );
      signIn(session, pending.method);
    } catch (e2) {
      setBusy(false);
      if (isApiError(e2, 'MFA_LOCKED') || isApiError(e2, 'INVALID_TOKEN')) {
        useFlowStore.getState().patch({ twoStep: null });
        setExpired(true);
        return;
      }
      setError(
        isApiError(e2, 'MFA_CODE_INVALID')
          ? t('errWrong', { left: metaNumber(e2, 'attemptsLeft', 0) })
          : tc(fallbackErrorKey(e2)),
      );
      setValue('');
      input.current?.focus();
    }
  };

  if (expired) {
    return (
      <>
        <div>
          <h1>{t('title')}</h1>
        </div>
        <Alert kind="bad">{t('expired')}</Alert>
        <Btn type="button" onClick={() => go(FIRST_STEP[page])}>
          {t('again')}
        </Btn>
      </>
    );
  }

  return (
    <>
      <BackLink to={FIRST_STEP[page]} />
      <div>
        <h1>{t('title')}</h1>
        <p className={s.sub}>{recovery ? t('subRecovery') : t('sub')}</p>
      </div>
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <Field
          id="two-step"
          label={recovery ? t('recoveryLabel') : t('codeLabel')}
          error={error}
          input={{
            ref: input,
            value,
            autoFocus: true,
            ...(recovery
              ? {
                  autoComplete: 'off',
                  autoCapitalize: 'characters',
                  spellCheck: false,
                  placeholder: 'ABCDE-FGHJK',
                }
              : {
                  inputMode: 'numeric',
                  autoComplete: 'one-time-code',
                  maxLength: 6,
                  placeholder: '123456',
                }),
            onChange: (e) => {
              setValue(e.target.value);
              if (error) setError(null);
            },
          }}
        />
        <Btn type="submit" busy={busy} busyLabel={t('checking')}>
          {t('continue')}
        </Btn>
      </form>
      <p className={s.small}>
        <button
          type="button"
          className={s.link}
          onClick={() => {
            setRecovery((r) => !r);
            setValue('');
            setError(null);
            input.current?.focus();
          }}
        >
          {recovery ? t('useApp') : t('useRecovery')}
        </button>
      </p>
    </>
  );
}
