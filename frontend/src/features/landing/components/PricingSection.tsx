import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { landingButton } from '../util/landingButton';
import { FeeCalculator } from './FeeCalculator';
import s from './landing.module.css';

const INCLUDED = ['noFee', 'posFree', 'payouts', 'tools', 'cancel'] as const;

/** Pricing: the commission card and the fee calculator (the platform's current settings). */
export function PricingSection({
  commissionPct,
  payoutDays,
}: {
  commissionPct: number;
  payoutDays: number;
}) {
  const t = useTranslations('marketing');
  return (
    <section id="pricing" className={s.section}>
      <div className={s.wrap}>
        <div className={cn(s.secH, s.center)}>
          <span className={s.eyebrow}>{t('pricing.eyebrow')}</span>
          <h2 className={s.h2}>{t('pricing.title')}</h2>
        </div>
        <div className={s.priceG}>
          <div className={cn('glass', s.panel, s.pcard)}>
            <div>
              <span className={s.pbig}>{commissionPct}%</span>{' '}
              <span className={s.muted}>{t('pricing.perOrder')}</span>
            </div>
            <ul className={s.plist}>
              {INCLUDED.map((key) => (
                <li key={key}>
                  <Icon name="check" size={20} strokeWidth={1.9} />
                  <span>{t(`pricing.included.${key}`, { days: payoutDays })}</span>
                </li>
              ))}
            </ul>
            <Link className={landingButton('primary', 'md', s.selfStart)} href="/create-business">
              {t('hero.openShopFree')}
            </Link>
          </div>
          <FeeCalculator commissionPct={commissionPct} payoutDays={payoutDays} />
        </div>
      </div>
    </section>
  );
}
