'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import { fallbackErrorKey, isApiError, type ApiError } from '@/lib/api';

import { resetPassword } from '../api';
import { useFlowActions } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import { passwordOk } from '../util/rules';
import { Btn, Field, RulesList } from './parts';
import s from './signIn.module.css';

/** VALIDATION_FAILED because the new password is the current (or a previous) one. */
function reusedPassword(e: ApiError) {
  return e.details.some(
    (d) =>
      /REUSE|SAME|CURRENT/i.test(String(d.meta?.reason ?? '')) ||
      /reuse|same as|current password|used before/i.test(d.message ?? ''),
  );
}

/** "Choose a new password" after a reset code: 4 rules, not the current one; then signs in. */
export function NewpassStep() {
  const t = useTranslations('auth.newpass');
  const tc = useTranslations('common');
  const { signIn } = useFlowActions();
  const email = useFlowStore((st) => st.email);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = !passwordOk(pw) ? t('errRules') : null;
    setError(err);
    if (err) return input.current?.focus();
    const resetToken = useFlowStore.getState().resetToken;
    setBusy(true);
    try {
      if (!resetToken) throw new Error('no reset token');
      const session = await resetPassword(resetToken, pw);
      useFlowStore.getState().patch({ lockUntil: 0 });
      signIn(session, 'reset');
    } catch (e) {
      setBusy(false);
      setError(
        !isApiError(e) || isApiError(e, 'INVALID_TOKEN')
          ? t('errExpired')
          : isApiError(e, 'VALIDATION_FAILED')
            ? reusedPassword(e)
              ? t('errReused')
              : t('errRules')
            : tc(fallbackErrorKey(e)),
      );
      input.current?.focus();
    }
  };

  return (
    <>
      <div>
        <h1>{t('title')}</h1>
        <p className={s.sub}>{t.rich('sub', { email, b: (c) => <b>{c}</b> })}</p>
      </div>
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <input type="email" autoComplete="username" value={email} hidden readOnly />
        <Field
          id="pw"
          label={t('label')}
          password
          error={error}
          after={<RulesList value={pw} />}
          input={{
            ref: input,
            autoComplete: 'new-password',
            value: pw,
            onChange: (e) => {
              setPw(e.target.value);
              if (error) setError(null);
            },
          }}
        />
        <Btn type="submit" busy={busy} busyLabel={t('saving')}>
          {t('save')}
        </Btn>
      </form>
    </>
  );
}
