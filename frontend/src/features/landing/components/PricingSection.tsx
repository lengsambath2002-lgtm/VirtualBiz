import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui';
import { Link } from '@/lib/i18n/navigation';
import { ONLINE_COMMISSION_RATE } from '@/lib/pricing';
import { cn } from '@/lib/utils/cn';

import { landingButton } from '../util/landingButton';
import { FeeCalculator } from './FeeCalculator';
import s from './landing.module.css';

const INCLUDED = ['noFee', 'posFree', 'payouts', 'tools', 'cancel'] as const;

/** Pricing: the 5% card and the fee calculator. */
export function PricingSection() {
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
              <span className={s.pbig}>{ONLINE_COMMISSION_RATE * 100}%</span>{' '}
              <span className={s.muted}>{t('pricing.perOrder')}</span>
            </div>
            <ul className={s.plist}>
              {INCLUDED.map((key) => (
                <li key={key}>
                  <Icon name="check" size={20} strokeWidth={1.9} />
                  <span>{t(`pricing.included.${key}`)}</span>
                </li>
              ))}
            </ul>
            <Link className={landingButton('primary', 'md', s.selfStart)} href="/create-business">
              {t('hero.openShopFree')}
            </Link>
          </div>
          <FeeCalculator />
        </div>
      </div>
    </section>
  );
}
