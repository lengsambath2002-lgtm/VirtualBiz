import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import type { DistrictId } from '../types';
import { landingButton } from '../util/landingButton';
import { searchHref } from '../util/searchHref';
import { HeroSearch } from './HeroSearch';
import s from './landing.module.css';
import { PhoneMock } from './PhoneMock';

const POPULAR = ['popularCoffee', 'popularHaircut', 'popularPhoneRepair'] as const;

export function LandingHero({ districts }: { districts: DistrictId[] }) {
  const t = useTranslations('marketing.hero');
  return (
    <section className={s.hero}>
      <div className={cn(s.wrap, s.heroG)}>
        <div>
          <span className={s.eyebrow}>{t('eyebrow')}</span>
          <h1 className={s.heroTitle}>{t.rich('title', { em: (chunks) => <em>{chunks}</em> })}</h1>
          <p className={cn(s.lead, s.heroLead)}>{t('lead')}</p>
          <HeroSearch districts={districts} />
          <div className={s.hintRow}>
            <span>{t('popular')}</span>
            {POPULAR.map((key) => (
              <Link key={key} className={cn('glass', s.hintChip)} href={searchHref({ q: t(key) })}>
                {t(key)}
              </Link>
            ))}
          </div>
          <div className={s.bizCta}>
            <Link className={landingButton('accent')} href="/create-business">
              {t('openShopFree')}
            </Link>
            <span className={s.muted}>{t('setupNote')}</span>
          </div>
        </div>
        <PhoneMock district={districts[0]} />
      </div>
    </section>
  );
}
