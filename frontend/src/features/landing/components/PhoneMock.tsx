import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui';
import { formatUsd, formatUsdAsKhr } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

import type { DistrictId } from '../types';
import s from './landing.module.css';

// Decorative glyphs from the prototype's phone screenshot (the whole mock is aria-hidden).
const CATS = [
  ['cafe', '☕', s.t1],
  ['phones', '📱', s.t2],
  ['fashion', '👕', s.t4],
  ['spa', '🌿', s.t3],
  ['salon', '✂️', s.t6],
] as const;
const TABS = ['⌂', '⌕', '%', '🛒', '☺'];
// Float-card icons use the prototype's plain (square-cap) 2px stroke.
const FLOAT_ICON = {
  size: 20,
  strokeWidth: 2,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
} as const;

/** Hero phone mock-up of the customer app with three floating status cards. */
export function PhoneMock({ district }: { district?: DistrictId }) {
  const t = useTranslations('marketing');
  const tc = useTranslations('common');
  return (
    <div className={s.heroArt} aria-hidden="true">
      <div className={s.phone}>
        <div className={s.scr}>
          <div className={s.scrTop}>
            <span className={s.deliver}>
              {t.rich('phone.deliverTo', {
                district: district ? tc(`districts.${district}`) : '',
                b: (chunks) => <b>{chunks}</b>,
              })}
            </span>
            <b>{t('phone.greeting')}</b>
            <div className={s.scrS}>
              <Icon
                name="search"
                size={14}
                strokeWidth={2}
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
              {t('phone.search')}
            </div>
          </div>
          <div className={s.scrCats}>
            {CATS.map(([key, glyph, tint]) => (
              <span key={key}>
                <i className={tint}>{glyph}</i>
                {t(`phone.cats.${key}`)}
              </span>
            ))}
          </div>
          <div className={s.scrG}>
            <div className={s.scrC}>
              <div className={cn(s.ph, s.t1)}>☕</div>
              <b>{t('phone.latte')}</b>
              <span>
                <em>{formatUsd(2)}</em> <s>{formatUsd(2.5)}</s>
              </span>
            </div>
            <div className={s.scrC}>
              <div className={cn(s.ph, s.t3)}>🌿</div>
              <b>{t('phone.massage')}</b>
              <span>
                <em>{formatUsd(20)}</em> · {t('phone.duration', { minutes: 60 })}
              </span>
            </div>
            <div className={s.scrC}>
              <div className={cn(s.ph, s.t2)}>📱</div>
              <b>{t('mock.iphone')}</b>
              <span>
                <b>{formatUsd(787.55)}</b>
              </span>
            </div>
            <div className={s.scrC}>
              <div className={cn(s.ph, s.t4)}>🧣</div>
              <b>{t('phone.krama')}</b>
              <span>
                <b>{formatUsd(9)}</b>
              </span>
            </div>
          </div>
          <div className={s.scrTab}>
            {TABS.map((glyph, i) => (
              <span key={glyph} className={i === 0 ? s.on : undefined}>
                {glyph}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className={cn(s.float, s.f1)}>
        <span className={cn(s.floatIc, s.t3)}>
          <Icon name="check" {...FLOAT_ICON} />
        </span>
        <span>
          <b>{t('phone.booked')}</b>
          <span className={s.muted}>{t('phone.bookedAt')}</span>
        </span>
      </div>
      <div className={cn(s.float, s.f2)}>
        <span className={cn(s.floatIc, s.t6)}>
          <Icon name="qr" {...FLOAT_ICON} />
        </span>
        <span>
          <b>{t('phone.paid')}</b>
          <span className={cn(s.muted, 'num')}>
            {formatUsd(4)} · {formatUsdAsKhr(4)}
          </span>
        </span>
      </div>
      <div className={cn(s.float, s.f3)}>
        <span className={cn(s.floatIc, s.t2)}>
          <Icon name="truck" {...FLOAT_ICON} />
        </span>
        <span>
          <b>{t('phone.onTheWay')}</b>
          <span className={s.muted}>{t('phone.rider')}</span>
        </span>
      </div>
    </div>
  );
}
