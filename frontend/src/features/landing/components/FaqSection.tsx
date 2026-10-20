import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui';
import { formatUsdWhole } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

import s from './landing.module.css';

const ITEMS = ['registered', 'paid', 'counter', 'delivery', 'staff', 'khmer'] as const;
/** Monthly online sales an unregistered individual seller may take (prototype rule). */
const INDIVIDUAL_SELLER_LIMIT_USD = 1000;

/** FAQ accordion (native <details>; items open and close independently). */
export function FaqSection({ payoutDays }: { payoutDays: number }) {
  const t = useTranslations('marketing.faq');
  return (
    <section id="faq" className={cn(s.section, s.flushTop)}>
      <div className={s.wrap}>
        <div className={cn(s.secH, s.center)}>
          <span className={s.eyebrow}>{t('eyebrow')}</span>
          <h2 className={s.h2}>{t('title')}</h2>
        </div>
        <div className={s.faq}>
          {ITEMS.map((key) => (
            <details key={key} className={cn('glass', s.panel)}>
              <summary>
                {t(`items.${key}.q`)}
                <Icon name="plus" size={20} strokeWidth={1.9} />
              </summary>
              <p>
                {key === 'registered'
                  ? t('items.registered.a', { limit: formatUsdWhole(INDIVIDUAL_SELLER_LIMIT_USD) })
                  : t(`items.${key}.a`, { days: payoutDays })}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
