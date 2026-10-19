import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';

import s from './landing.module.css';

const METHODS = ['khqr', 'abaPay', 'acleda', 'wing', 'visa', 'mastercard'] as const;

/** "Pay your way" trust strip with the accepted payment methods. */
export function PaymentStrip() {
  const t = useTranslations('marketing.trust');
  const tc = useTranslations('common.payments');
  return (
    <div className={s.wrap}>
      <div className={cn(s.trust)}>
        <span>{t('payYourWay')}</span>
        <div className={s.pay}>
          {METHODS.map((m) => (
            <span key={m}>{tc(m)}</span>
          ))}
          <span>{t('cash')}</span>
        </div>
      </div>
    </div>
  );
}
