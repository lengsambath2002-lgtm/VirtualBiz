'use client';

import { useTranslations } from 'next-intl';
import type { ChangeEvent } from 'react';

import { isApiError } from '@/lib/api';

import { useBusinessStatus, useResubmitId } from '../queries';
import st from './status.module.css';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Settings: the shop's ID check (checking / verified / rejected with the reason) and, until it
 * is verified, a button to send a new ID photo. The surface passes its panel and button classes.
 */
export function VerificationPanel({
  businessId,
  bakongId,
  panel,
  head,
  body,
  btn,
  onToast,
}: {
  businessId?: string;
  bakongId?: string | null;
  panel: string | undefined;
  head: string | undefined;
  body: string | undefined;
  btn: string | undefined;
  onToast: (msg: string) => void;
}) {
  const t = useTranslations('common.businessStatus');
  const { data: b } = useBusinessStatus(businessId);
  const send = useResubmitId(businessId);
  if (!b) return null;
  const v = b.verification;
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return onToast(t('idType'));
    if (f.size > MAX_BYTES) return onToast(t('idSize'));
    const r = new FileReader();
    r.onload = () =>
      void send
        .mutateAsync(String(r.result))
        .then(() => onToast(t('idSent')))
        .catch((x: unknown) =>
          onToast(isApiError(x, 'VALIDATION_FAILED') ? t('idType') : t('idFailed')),
        );
    r.readAsDataURL(f);
  };
  return (
    <section className={panel}>
      <div className={head}>
        <h2>{t('title')}</h2>
        <span className={`${st.pill} ${v === 'VERIFIED' ? st.ok : ''}`}>{t(`state.${v}`)}</span>
      </div>
      <div className={body} style={{ display: 'grid', gap: 10 }}>
        <p className={st.muted} style={{ margin: 0 }}>
          {v === 'VERIFIED'
            ? bakongId
              ? t('verifiedBody', { bakong: bakongId })
              : t('verifiedNoBakong')
            : v === 'REJECTED'
              ? t('rejectedBody', { reason: b.verificationNote ?? '' })
              : t('pendingBody')}
        </p>
        {v !== 'VERIFIED' && (
          <div>
            <label className={`${btn ?? ''} ${st.file}`} aria-busy={send.isPending}>
              {send.isPending ? t('sending') : t('sendId')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFile}
                aria-label={t('sendId')}
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
