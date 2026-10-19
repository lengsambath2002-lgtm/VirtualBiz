'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ErrorView } from '@/components/feedback';
import { formatUsd } from '@/lib/money';

import { useShopPayouts } from '../queries';
import st from './status.module.css';

/** Settings: what VirtualBiz holds for the shop and the latest transfers (owner and managers). */
export function PayoutsPanel({
  businessId,
  panel,
  head,
  body,
}: {
  businessId?: string;
  panel: string | undefined;
  head: string | undefined;
  body: string | undefined;
}) {
  const t = useTranslations('common.businessStatus.payouts');
  const locale = useLocale();
  const { data, error, refetch } = useShopPayouts(businessId);
  if (!data)
    return error ? (
      <section className={panel}>
        <div className={head}>
          <h2>{t('title')}</h2>
        </div>
        <ErrorView error={error} retry={() => void refetch()} size="panel" home={null} />
      </section>
    ) : null;
  const b = data.balance;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'kh' ? 'km-KH' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Phnom_Penh',
    });
  return (
    <section className={panel}>
      <div className={head}>
        <h2>{t('title')}</h2>
      </div>
      <div className={body} style={{ display: 'grid', gap: 14 }}>
        <div className={st.figures}>
          <div>
            <span className={st.muted}>{t('payable')}</span>
            <b>{formatUsd(Math.max(0, b?.payable ?? 0))}</b>
          </div>
          <div>
            <span className={st.muted}>{t('onHold')}</span>
            <b>{formatUsd(b?.onHold ?? 0)}</b>
          </div>
        </div>
        <p className={st.muted} style={{ margin: 0 }}>
          {t('how', { days: data.releaseDays, pct: data.commissionPct })}
        </p>
        {data.payouts.length > 0 ? (
          <ul className={st.list}>
            {data.payouts.map((p) => (
              <li key={p.id}>
                <span>
                  {date(p.paidAt)}
                  <span className={st.muted}> · {p.reference}</span>
                </span>
                <strong className={st.num}>{formatUsd(p.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <span className={st.muted}>{t('none')}</span>
        )}
      </div>
    </section>
  );
}
