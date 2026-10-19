'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Icon, type IconName } from '@/components/ui';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { landingButton } from '../util/landingButton';
import { BookingsMock, RegisterMock } from './BusinessMocks';
import s from './landing.module.css';

type Tab = 'sell' | 'book';

const FEATS = {
  sell: [
    ['pos', 'cash'],
    ['online', 'truck'],
    ['stock', 'scan'],
    ['options', 'box'],
  ],
  book: [
    ['calendar', 'calendar'],
    ['noShows', 'bell'],
    ['checkout', 'cash'],
    ['clients', 'users'],
  ],
} as const satisfies Record<Tab, readonly (readonly [string, IconName])[]>;

const LINKS: Record<Tab, string> = { sell: '/seller', book: '/provider' };

/** Navy "For business" band with the "I sell products" / "I take bookings" tabs. */
export function BusinessBand() {
  const t = useTranslations('marketing.business');
  const [tab, setTab] = useState<Tab>('sell');
  const panelId = useId();

  const feats =
    tab === 'sell'
      ? FEATS.sell.map(([key, icon]) => ({
          key,
          icon,
          title: t(`sell.feats.${key}.title`),
          body: t(`sell.feats.${key}.body`),
        }))
      : FEATS.book.map(([key, icon]) => ({
          key,
          icon,
          title: t(`book.feats.${key}.title`),
          body: t(`book.feats.${key}.body`),
        }));

  return (
    <section id="business" className={cn(s.section, s.band)}>
      <div className={s.wrap}>
        <div className={s.secH}>
          <span className={s.eyebrow}>{t('eyebrow')}</span>
          <h2 className={cn(s.h2, s.bandTitle)}>{t('title')}</h2>
          <p className={s.lead}>{t('lead')}</p>
        </div>
        <div className={s.bseg} role="tablist" aria-label={t('tabsLabel')}>
          {(['sell', 'book'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              aria-controls={panelId}
              onClick={() => setTab(k)}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
        <div className={s.bgrid} id={panelId} role="tabpanel">
          <div className={s.feats}>
            {feats.map((f) => (
              <div key={f.key} className={s.feat}>
                <span className={s.featIc}>
                  <Icon name={f.icon} size={22} strokeWidth={1.9} />
                </span>
                <span>
                  <b>{f.title}</b>
                  <span>{f.body}</span>
                </span>
              </div>
            ))}
            <Link className={landingButton('accent', 'md', s.featCta)} href={LINKS[tab]}>
              {t(`${tab}.cta`)}
            </Link>
          </div>
          <div className={s.mock} aria-label={t('previewLabel')}>
            {tab === 'sell' ? <RegisterMock /> : <BookingsMock />}
          </div>
        </div>
      </div>
    </section>
  );
}
