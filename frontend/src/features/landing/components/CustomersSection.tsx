import { useTranslations } from 'next-intl';

import { Icon, isIconName } from '@/components/ui';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import type { LandingCategory } from '../types';
import { landingButton } from '../util/landingButton';
import { searchHref } from '../util/searchHref';
import s from './landing.module.css';

const TINT = [s.t1, s.t1, s.t2, s.t3, s.t4, s.t5, s.t6] as const;
const STEPS = ['find', 'order', 'pay'] as const;

/** "For customers": category tiles, three steps and a link into the marketplace. */
export function CustomersSection({ categories }: { categories: LandingCategory[] }) {
  const t = useTranslations('marketing.customers');
  const tc = useTranslations('common.categories');
  return (
    <section id="customers" className={s.section}>
      <div className={s.wrap}>
        <div className={cn(s.secH, s.center)}>
          <span className={s.eyebrow}>{t('eyebrow')}</span>
          <h2 className={s.h2}>{t('title')}</h2>
          <p className={s.lead}>{t('lead')}</p>
        </div>
        <div className={s.cats}>
          {categories.map((c) => (
            <Link
              key={c.id}
              className={cn('glass', s.panel, s.cat)}
              href={searchHref({ category: c.id })}
            >
              <span className={cn(s.catIc, TINT[c.tint])}>
                {isIconName(c.icon) && <Icon name={c.icon} size={26} strokeWidth={1.9} />}
              </span>
              {tc(c.id)}
              <small>{t(`categoryNotes.${c.id}`)}</small>
            </Link>
          ))}
        </div>
        <div className={s.steps}>
          {STEPS.map((key, i) => (
            <div key={key} className={cn('glass', s.panel, s.step)}>
              <span className={s.stepN}>{i + 1}</span>
              <h3>{t(`steps.${key}.title`)}</h3>
              <p>{t(`steps.${key}.body`)}</p>
            </div>
          ))}
        </div>
        <div className={s.exploreRow}>
          <Link className={landingButton('primary', 'lg')} href={searchHref()}>
            {t('startExploring')}
          </Link>
        </div>
      </div>
    </section>
  );
}
