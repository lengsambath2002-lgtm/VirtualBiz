'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { EmptyView, ErrorView } from '@/components/feedback';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { OpenLabel, ProductCard, itemHref } from '@/features/shop-shared/components/cards';
import {
  ReviewItem,
  useReviewRows,
  useShopReviewsLoad,
} from '@/features/shop-shared/components/Reviews';
import { Crumbs, NotFound, Ph, Star } from '@/features/shop-shared/components/ui';
import { useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import { dist, hoursOn, freeOver } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useIsSaved, useToggleSavedKey } from '@/features/shop-shared/saved';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { ShopView } from '@/features/shop-shared/types';
import { useCopy } from '@/features/shop-shared/useCopy';
import { searchHref } from '@/features/shop-search/util/searchParams';

/** "7:00" for 420. */
export const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

/** Weekly hours grouped into runs of equal days (Monday first). */
function useHoursText(sh: ShopView) {
  const t = useTranslations('shop.store');
  const days = t('weekdays').split(',');
  const fmt = (h: ShopView['hours'][number]) =>
    h ? `${hhmm(h[0])}–${hhmm(h[1])}` : t('closedDay');
  const all = sh.hours.map(fmt);
  if (all.every((x) => x === all[0]) && sh.hours[0]) return t('everyDay', { hours: all[0]! });
  const runs: string[] = [];
  for (let i = 0; i < 7; ) {
    let j = i;
    while (j + 1 < 7 && all[j + 1] === all[i]) j++;
    runs.push(`${days[i]}${j > i ? '–' + days[j] : ''} ${all[i]}`);
    i = j + 1;
  }
  return runs.join(' · ');
}

const mapsSearch = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

function StoreView({ sh }: { sh: ShopView }) {
  const t = useTranslations('shop.store');
  const th = useTranslations('shop.home');
  const tt = useTranslations('shop.toast');
  const f = useFmt();
  const copy = useCopy();
  const needAuth = useNeedAuth();
  const { items, deals, districts, item } = useShopData();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const following = useIsSaved('shop:' + sh.id);
  const toggleSaved = useToggleSavedKey();
  const rowsFor = useReviewRows(sh.id);
  const reviewsLoad = useShopReviewsLoad(sh.id);
  const [tab, setTab] = useState<'items' | 'reviews' | 'about'>('items');
  const its = items.filter((i) => i.shop === sh.id);
  const evs = deals.filter((e) => e.shop === sh.id);
  const rv = its.flatMap((i) => rowsFor(i.id)).sort((a, b) => b.at - a.at);
  const today = hoursOn(sh);
  const hoursText = useHoursText(sh);

  const follow = () =>
    needAuth('followShops', () => {
      const now = toggleSaved('shop:' + sh.id);
      toast(now ? tt('following', { shop: sh.name }) : tt('unfollowed'));
    });

  return (
    <>
      <Crumbs
        items={[
          { label: th('crumbHome'), href: '/home' },
          {
            label: f.category(sh.catId),
            href: searchHref({ type: sh.kind, category: [sh.catId] }),
          },
          { label: sh.name },
        ]}
      />
      <div className={cn(s.shopHero, s.glassMat)}>
        <Ph hue={sh.hue} icon={sh.icon} photo={sh.cover} className={s.shopCover} />
        <div className={s.shopIn}>
          <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} className={s.logoB} />
          <div style={{ minWidth: 0 }}>
            <h1>{sh.name}</h1>
            <div className={s.metaRow}>
              {f.category(sh.catId)} · {f.district(sh.area)} · <OpenLabel shop={sh} />{' '}
              {today ? `${hhmm(today[0])}–${hhmm(today[1])}` : ''}
            </div>
            <div className={s.stats}>
              <span>
                <Star n={sh.rating} /> <b className="num">{sh.rating.toFixed(1)}</b> ({rv.length})
              </span>
              <span>
                {t.rich(sh.kind === 'service' ? 'services' : 'products', {
                  n: its.length,
                  b: (c) => <b className="num">{c}</b>,
                })}
              </span>
              <span>
                {t.rich('away', {
                  km: dist(sh, area, districts, here),
                  b: (c) => <b className="num">{c}</b>,
                })}
              </span>
              <span>{t('replies', { time: sh.resp })}</span>
              <span>{t.rich('since', { year: String(sh.since), b: (c) => <b>{c}</b> })}</span>
            </div>
          </div>
          <div className={s.acts}>
            <button
              className={cn(s.btn, following ? s.btnGhost : s.btnPrimary)}
              aria-pressed={following}
              onClick={follow}
            >
              <Ic name="heart" size={18} />
              {following ? t('following') : t('follow')}
            </button>
            <button className={cn(s.btn, s.btnGhost)} onClick={() => copy(f.phone(sh.phone))}>
              <Ic name="phone" size={18} />
              <span className="num">{f.phone(sh.phone)}</span>
            </button>
          </div>
        </div>
      </div>
      {evs.map((e) => (
        <div key={e.id} className={cn(s.alert, s.aWarn, s.alertLg)}>
          <Ic name="tag" size={18} />
          <span>
            <strong>{e.title}</strong> · {e.body}{' '}
            <span className={cn(s.muted, s.small)}>{t('ends', { date: f.fmtD(e.ends) })}</span>
          </span>
        </div>
      ))}
      <div className={s.tabs}>
        {(
          [
            ['items', sh.kind === 'service' ? t('tabServices') : t('tabProducts'), its.length],
            ['reviews', t('tabReviews'), rv.length],
            ['about', t('tabAbout'), null],
          ] as const
        ).map(([k, l, c]) => (
          <button key={k} className={cn(tab === k && s.on)} onClick={() => setTab(k)}>
            {l}
            {c !== null && <span className={cn(s.ct, 'num')}>{c}</span>}
          </button>
        ))}
      </div>
      {tab === 'items' ? (
        its.length ? (
          <div className={s.grid}>
            {its.map((it) => (
              <ProductCard key={it.id} it={it} />
            ))}
          </div>
        ) : (
          <div className={cn(s.panel, s.glassMat)}>
            <EmptyView
              title={sh.kind === 'service' ? t('noServices') : t('noProducts')}
              body={t('noItemsBody')}
            />
          </div>
        )
      ) : tab === 'reviews' ? (
        <div className={cn(s.panel, s.glassMat)}>
          {reviewsLoad.error ? (
            <ErrorView
              error={reviewsLoad.error}
              retry={reviewsLoad.retry}
              size="panel"
              home={null}
            />
          ) : (
            !rv.length && <EmptyView title={t('noReviews')} body={t('noReviewsBody')} />
          )}
          {rv.map((x) => {
            const it = item(x.itemId);
            return (
              <ReviewItem
                key={x.itemId + x.key}
                r={x}
                meta={
                  it ? (
                    <>
                      {' · '}
                      <Link href={itemHref(it)} className={s.muted}>
                        {it.name}
                      </Link>
                    </>
                  ) : null
                }
              />
            );
          })}
        </div>
      ) : (
        <div className={cn(s.panel, s.glassMat)}>
          <p className={s.desc}>{sh.about}</p>
          <dl className={s.spec}>
            <dt>{t('address')}</dt>
            <dd>
              {t('addressLine', { addr: sh.addr, area: f.district(sh.area) })} ·{' '}
              <a
                href={mapsSearch(`${sh.name} ${sh.addr} Phnom Penh`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('openMaps')}
              </a>
            </dd>
            <dt>{t('hours')}</dt>
            <dd>{hoursText}</dd>
            <dt>{t('phone')}</dt>
            <dd className="num">{f.phone(sh.phone)}</dd>
            {sh.eta && (
              <>
                <dt>{t('delivery')}</dt>
                <dd>
                  {t('deliveryText', {
                    a: sh.eta[0],
                    b: sh.eta[1],
                    amount: f.money(freeOver(sh)),
                  })}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </>
  );
}

export function StorePage({ id }: { id: string }) {
  const tm = useTranslations('shop.common');
  const { shop } = useShopData();
  const sh = shop(id);
  if (!sh) return <NotFound title={tm('missing.shop')} />;
  return <StoreView key={id} sh={sh} />;
}
