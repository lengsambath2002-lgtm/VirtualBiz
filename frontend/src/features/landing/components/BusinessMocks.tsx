import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';

import { Icon } from '@/components/ui';
import { formatCashChange, formatUsd, formatUsdWhole } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

import s from './landing.module.css';

/** Seller POS register preview ("I sell products"). */
export function RegisterMock() {
  const t = useTranslations('marketing');
  const tiles = [
    { name: t('mock.iphone'), price: 829, tint: s.t2, icon: 'phone' },
    { name: t('mock.airpods'), price: 224, tint: s.t5, icon: 'phone' },
    { name: t('business.sell.mock.cable'), price: 6, tint: s.t1, icon: 'box' },
  ] as const;
  return (
    <>
      <div className={s.mockH}>
        <b>{t('business.sell.mock.register')}</b>
        <span className={s.shiftBadge}>{t('business.sell.mock.shiftOpen')}</span>
      </div>
      <div className={s.mGrid}>
        {tiles.map((tile) => (
          <div key={tile.name} className={s.mTile}>
            <span className={cn(s.mTileIc, tile.tint)}>
              <Icon name={tile.icon} size={16} strokeWidth={1.9} />
            </span>
            <b>{tile.name}</b>
            <span>{formatUsdWhole(tile.price)}</span>
          </div>
        ))}
      </div>
      <div className={s.mCart}>
        <div className={s.mRow}>
          <span>{t('business.sell.mock.lineIphone')}</span>
          <b>{formatUsd(829)}</b>
        </div>
        <div className={s.mRow}>
          <span>{t('business.sell.mock.lineCable')}</span>
          <b>{formatUsd(12)}</b>
        </div>
        <div className={cn(s.mRow, s.mTotal)}>
          <b>{t('business.sell.mock.total')}</b>
          <b>{formatUsd(841)}</b>
        </div>
      </div>
      <div className={s.mPay}>
        {t('business.sell.mock.change', { change: formatCashChange(8, 1100) })}
      </div>
      <div className={s.mBtn}>{t('business.sell.mock.completeSale')}</div>
    </>
  );
}

const STAFF = [
  ['dana', '#7C5CFA'],
  ['srey', '#D9558F'],
  ['vicheka', '#1F9C8B'],
] as const;
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
type EventKey = 'chavRada' | 'sokhaGel' | 'mithonaColour' | 'vannak' | 'sreypov' | 'bopha';
/** `${row}-${staff column}` → booking. */
const EVENTS: Record<string, EventKey> = {
  '0-0': 'chavRada',
  '1-1': 'sokhaGel',
  '2-2': 'mithonaColour',
  '4-0': 'vannak',
  '4-2': 'sreypov',
  '5-1': 'bopha',
};

/** Provider calendar preview ("I take bookings"). */
export function BookingsMock() {
  const t = useTranslations('marketing.business.book.mock');
  return (
    <>
      <div className={s.mockH}>
        <b>{t('today')}</b>
        <span className={cn('num', s.mockDate)}>{t('date')}</span>
      </div>
      <div className={cn('glass', s.cal)}>
        <div />
        {STAFF.map(([key, color]) => (
          <div key={key} className={s.calHd}>
            <span className={s.calDot} style={{ background: color }} />
            {t(`staff.${key}`)}
          </div>
        ))}
        {HOURS.map((hour, row) => [
          <div key={hour}>{hour}</div>,
          ...STAFF.map(([key, color], col) => {
            const ev = EVENTS[`${row}-${col}`];
            return (
              <div key={`${hour}-${key}`}>
                {ev && (
                  <span
                    className={cn('glass', s.ev)}
                    style={{ boxShadow: `inset 3px 0 0 ${color}` } as CSSProperties}
                  >
                    {t(`events.${ev}`)}
                  </span>
                )}
              </div>
            );
          }),
        ])}
      </div>
      <div className={cn(s.mRow, s.requests)}>
        <span>{t('requests', { count: 3 })}</span>
        <span>{t('review')}</span>
      </div>
    </>
  );
}
