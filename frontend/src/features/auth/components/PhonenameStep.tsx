'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';

import { registerPhone } from '../api';
import { useFlowActions } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import { emailOk } from '../util/rules';
import { Alert, Btn, Field } from './parts';
import s from './signIn.module.css';

/** "Almost done": a new phone number needs a name (and optionally an email for receipts). */
export function PhonenameStep() {
  const t = useTranslations('auth.phonename');
  const tc = useTranslations('common');
  const { signIn, askTwoStep } = useFlowActions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errName, setErrName] = useState<string | null>(null);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const em = email.trim().toLowerCase();
    const en = n.length < 2 ? t('errName') : null;
    const ee = em && !emailOk(em) ? t('errEmail') : null;
    setErrName(en);
    setErrEmail(ee);
    setFailed(null);
    if (en || ee) return;
    const phoneToken = useFlowStore.getState().phoneToken;
    setBusy(true);
    try {
      if (!phoneToken) throw new Error('no phone token');
      signIn(await registerPhone({ phoneToken, name: n, ...(em ? { email: em } : {}) }), 'phone');
    } catch (err) {
      setBusy(false);
      if (askTwoStep(err, 'phone')) return;
      if (isApiError(err, 'CONFLICT')) setErrEmail(t('errEmailTaken'));
      else if (!isApiError(err) || isApiError(err, 'INVALID_TOKEN')) setFailed(t('errExpired'));
      else setFailed(tc(fallbackErrorKey(err)));
    }
  };

  return (
    <>
      <div>
        <h1>{t('title')}</h1>
        <p className={s.sub}>{t('sub')}</p>
      </div>
      {failed && <Alert kind="bad">{failed}</Alert>}
      <form className={s.form} noValidate onSubmit={onSubmit}>
        <Field
          id="name"
          label={t('name')}
          error={errName}
          input={{
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
          id="em"
          label={
            <>
              {t('email')} <span className={s.labelNote}>{t('emailOptional')}</span>
            </>
          }
          error={errEmail}
          input={{
            type: 'email',
            autoComplete: 'email',
            placeholder: t('emailPlaceholder'),
            value: email,
            onChange: (e) => {
              setEmail(e.target.value);
              if (errEmail) setErrEmail(null);
            },
          }}
        />
        <Btn type="submit" busy={busy} busyLabel={t('creating')}>
          {t('create')}
        </Btn>
      </form>
    </>
  );
}
