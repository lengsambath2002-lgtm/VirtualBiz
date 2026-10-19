import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { landingButton } from '../util/landingButton';
import { searchHref } from '../util/searchHref';
import s from './landing.module.css';

/** Closing call to action with the "coming soon" app badges. */
export function FinalCta() {
  const t = useTranslations('marketing');
  return (
    <section className={cn(s.section, s.flushTop)}>
      <div className={s.wrap}>
        <div className={s.cta}>
          <h2 className={s.h2}>{t('cta.title')}</h2>
          <p className={s.ctaBody}>{t('cta.body')}</p>
          <div className={s.ctaB}>
            <Link className={landingButton('primary', 'lg')} href={searchHref()}>
              {t('cta.startShopping')}
            </Link>
            <Link className={landingButton('ghost', 'lg')} href="/create-business">
              {t('nav.openShop')}
            </Link>
          </div>
          <div className={s.apps}>
            <span>{t('cta.iphone')}</span>
            <span>{t('cta.android')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
