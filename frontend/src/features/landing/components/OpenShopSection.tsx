import { useTranslations } from 'next-intl';

import { Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

import s from './landing.module.css';

const STEPS = [
  ['business', 'store', s.t2],
  ['location', 'mapPin', s.t3],
  ['khqr', 'qr', s.t6],
] as const satisfies readonly (readonly [string, IconName, string | undefined])[];

/** "Open your shop in 3 steps". */
export function OpenShopSection() {
  const t = useTranslations('marketing.open');
  return (
    <section className={cn(s.section, s.flushTop)}>
      <div className={s.wrap}>
        <div className={cn(s.secH, s.center)}>
          <span className={s.eyebrow}>{t('eyebrow')}</span>
          <h2 className={s.h2}>{t('title')}</h2>
          <p className={s.lead}>{t('lead')}</p>
        </div>
        <div className={s.openG}>
          {STEPS.map(([key, icon, tint]) => (
            <div key={key} className={cn('glass', s.panel, s.ostep)}>
              <span className={cn(s.ostepIc, tint)}>
                <Icon
                  name={icon}
                  size={24}
                  strokeWidth={1.9}
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                />
              </span>
              <span>
                <b>{t(`steps.${key}.title`)}</b>
                <span>{t(`steps.${key}.body`)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
