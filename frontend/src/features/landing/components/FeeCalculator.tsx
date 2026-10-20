'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { formatUsdWhole } from '@/lib/money';
import { commissionEstimate } from '@/lib/pricing';
import { cn } from '@/lib/utils/cn';

import s from './landing.module.css';

const ONLINE = { min: 0, max: 10000, step: 100, initial: 2000 };
const COUNTER = { min: 0, max: 20000, step: 100, initial: 4000 };

/** "What would I pay?" — the commission on online sales only; counter (POS) sales are free. */
export function FeeCalculator({
  commissionPct,
  payoutDays,
}: {
  commissionPct: number;
  payoutDays: number;
}) {
  const t = useTranslations('marketing.pricing.calc');
  const [online, setOnline] = useState(ONLINE.initial);
  const [counter, setCounter] = useState(COUNTER.initial);
  const onlineId = useId();
  const counterId = useId();
  const { fee, keep, effectivePct } = commissionEstimate(online, counter, commissionPct / 100);
  const effective = online + counter ? `${effectivePct.toFixed(1)}%` : '0%';

  return (
    <div className={cn('glass', s.panel, s.pcard)}>
      <h3 className={s.calcTitle}>{t('title')}</h3>
      <div className={s.field}>
        <label htmlFor={onlineId}>
          <span>{t('online')}</span>
          <span className="num" data-testid="calc-online">
            {formatUsdWhole(online)}
          </span>
        </label>
        <input
          type="range"
          id={onlineId}
          min={ONLINE.min}
          max={ONLINE.max}
          step={ONLINE.step}
          value={online}
          onChange={(e) => setOnline(Number(e.target.value))}
        />
      </div>
      <div className={s.field}>
        <label htmlFor={counterId}>
          <span>{t('counter')}</span>
          <span className="num" data-testid="calc-counter">
            {formatUsdWhole(counter)}
          </span>
        </label>
        <input
          type="range"
          id={counterId}
          min={COUNTER.min}
          max={COUNTER.max}
          step={COUNTER.step}
          value={counter}
          onChange={(e) => setCounter(Number(e.target.value))}
        />
      </div>
      <div className={s.split}>
        <div>
          <span>{t('fee')}</span>
          <b className="num" data-testid="calc-fee">
            {formatUsdWhole(fee)}
          </b>
        </div>
        <div>
          <span>{t('keep')}</span>
          <b className="num" data-testid="calc-keep">
            {formatUsdWhole(keep)}
          </b>
        </div>
        <div>
          <span>{t('effective')}</span>
          <b className="num" data-testid="calc-effective">
            {effective}
          </b>
        </div>
      </div>
      <p className={cn(s.muted, s.calcNote)}>{t('note', { days: payoutDays })}</p>
    </div>
  );
}
