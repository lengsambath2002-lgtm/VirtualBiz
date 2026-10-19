'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import { fallbackErrorKey, isApiError, metaNumber } from '@/lib/api';

import { useAuthPage, useFlowActions } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import { maskPhoneInput, normalizePhoneInput, phoneInputOk } from '../util/rules';
import { FIRST_STEP } from '../types';
import { BackLink, Btn, Field } from './parts';
import s from './signIn.module.css';

/**
 * Phone number (+855), then an SMS code. Same path on both pages: a known number signs in, a
 * new one goes on to "Almost done". Only the wording differs.
 */
export function PhoneStep() {
  const t = useTranslations('auth.phone');
  const tc = useTranslations('common');
  const page = useAuthPage();
  const signUp = page === 'sign-up';
  const { go, startCode } = useFlowActions();
  const [value, setValue] = useState(() => maskPhoneInput(useFlowStore.getState().phone));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const d = normalizePhoneInput(value);
    const err = !d ? t('errEmpty') : !phoneInputOk(d) ? t('errInvalid') : null;
    setError(err);
    if (err) return input.current?.focus();
    setBusy(true);
    useFlowStore.getState().patch({ phone: d });
    try {
      await startCode('phone', d);
    } catch (e2) {
      setBusy(false);
      const otp = useFlowStore.getState().otp;
      // Asked again within 30 s: the code already sent still works.
      if (isApiError(e2, 'OTP_RESEND_TOO_SOON') && otp?.purpose === 'phone' && otp.to === d)
        return go('phone-code');
      setError(
        isApiError(e2, 'INVALID_PHONE')
          ? t('errInvalid')
          : isApiError(e2, 'OTP_RESEND_TOO_SOON')
            ? t('errWait', { seconds: metaNumber(e2, 'retryAfter', 30) })
            : tc(fallbackErrorKey(e2)),
      );
      return input.current?.focus();
    }
    go('phone-code');
  };

  return (
    <>
      <BackLink to={FIRST_STEP[page]} />
      <div>
        <h1>{t(signUp ? 'titleSignUp' : 'titleSignIn')}</h1>
        <p className={s.sub}>{t(signUp ? 'subSignUp' : 'subSignIn')}</p>
      </div>
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <Field
          id="ph"
          label={t('label')}
          error={error}
          prefix={<span className={s.cc}>{t('countryCode')}</span>}
          input={{
            ref: input,
            type: 'tel',
            autoComplete: 'tel-national',
            inputMode: 'tel',
            placeholder: t('placeholder'),
            value,
            onChange: (e) => {
              const el = e.target;
              const atEnd = el.selectionStart === el.value.length;
              const masked = maskPhoneInput(el.value);
              setValue(masked);
              if (error) setError(null);
              if (atEnd)
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = masked.length;
                });
            },
          }}
        />
        <Btn type="submit" busy={busy} busyLabel={t('sending')}>
          {t('send')}
        </Btn>
      </form>
    </>
  );
}
