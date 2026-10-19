'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { api, type ListingReview } from '@/lib/api';

import { cn } from '@/lib/utils/cn';

import { useFmt, useNeedAuth, useShopData } from '../hooks';
import { hueOf, initials } from '../rules';
import s from '../shop.module.css';
import { useMyReviews } from '../reviews';
import { QUICK_TAGS, writeReview, type QuickTag } from './sheets';
import { Pill, StarRow, tintClass } from './ui';

export interface ReviewRow {
  key: string;
  who: string;
  stars: number;
  text: string;
  at: number;
  opt?: string;
  reply?: string;
  mine?: boolean;
  itemId: string;
}

const LEVELS = ['', 'level.1', 'level.2', 'level.3', 'level.4', 'level.5'] as const;

const shopReviewsQuery = (shopId: string | undefined) => ({
  queryKey: ['shop', 'reviews', shopId],
  queryFn: () =>
    api.get<ListingReview[]>(`/marketplace/shops/${encodeURIComponent(shopId!)}/reviews`, {
      auth: false,
    }),
  enabled: !!shopId,
  staleTime: 60_000,
});

/** Whether a shop's reviews failed to load (nothing cached), and a retry. */
export function useShopReviewsLoad(shopId: string | undefined) {
  const q = useQuery(shopReviewsQuery(shopId));
  return { error: q.data ? null : q.error, retry: () => void q.refetch() };
}

/** A shop's listing reviews (`GET /api/marketplace/shops/{slug}/reviews`), grouped by item. */
export function useShopReviews(shopId: string | undefined) {
  const q = useQuery(shopReviewsQuery(shopId));
  return useMemo(
    () =>
      (q.data ?? []).reduce<Record<string, ListingReview[]>>((m, r) => {
        (m[r.itemSlug] ??= []).push(r);
        return m;
      }, {}),
    [q.data],
  );
}

/** A shop's listing reviews as display rows; the customer's own are marked `mine`. */
export function useReviewRows(shopId: string | undefined) {
  const t = useTranslations('shop.review');
  const reviews = useShopReviews(shopId);
  const { data: mine = [] } = useMyReviews();
  const myIds = new Set(mine.map((r) => r.id));
  // Quick tags are stored as keys and shown in the reader's language, before the text.
  const textOf = (r: ListingReview) => {
    const tags = r.tags
      .map((k) => ((QUICK_TAGS as readonly string[]).includes(k) ? t(`tags.${k as QuickTag}`) : k))
      .join(', ');
    return (
      [tags, r.text].filter(Boolean).join('. ') ||
      (LEVELS[r.stars] ? t(LEVELS[r.stars] as 'level.1') + '.' : '')
    );
  };
  return (itemId: string): ReviewRow[] =>
    (reviews[itemId] ?? []).map((r) => ({
      key: r.id,
      who: r.authorName,
      stars: r.stars,
      text: textOf(r),
      at: Date.parse(r.at),
      ...(r.variantName ? { opt: r.variantName } : {}),
      ...(r.reply ? { reply: r.reply } : {}),
      ...(myIds.has(r.id) ? { mine: true } : {}),
      itemId,
    }));
}

export function ReviewItem({
  r,
  shopName,
  meta,
}: {
  r: ReviewRow;
  shopName?: string;
  meta?: React.ReactNode;
}) {
  const t = useTranslations('shop.review');
  const f = useFmt();
  return (
    <div className={s.rv}>
      <div className={cn(s.avS, tintClass(hueOf(r.who)))}>{initials(r.who)}</div>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontWeight: 500 }}>{r.who}</strong>
          <StarRow n={r.stars} />
          <span className={cn(s.tiny, s.muted)}>
            {f.ago(r.at)}
            {meta ?? (r.opt ? ' · ' + r.opt : '')}
          </span>
          {shopName === undefined ? null : r.mine ? (
            <Pill tone="neutral">{t('you')}</Pill>
          ) : (
            <Pill tone="ok">{t('verified')}</Pill>
          )}
        </div>
        <p style={{ marginTop: 4 }}>{r.text}</p>
        {r.reply && shopName && (
          <div className={s.reply}>
            <strong style={{ fontWeight: 500 }}>{shopName}</strong> · {r.reply}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Reviews (n)" section with the rating summary, star filter and the list. */
export function ReviewsBlock({ itemId, shopName }: { itemId: string; shopName: string }) {
  const t = useTranslations('shop.review');
  const rowsFor = useReviewRows(useShopData().item(itemId)?.shop);
  const needAuth = useNeedAuth();
  const [filt, setFilt] = useState(0);
  const r = rowsFor(itemId);
  const avg = r.length ? r.reduce((a, x) => a + x.stars, 0) / r.length : 0;
  const list = filt ? r.filter((x) => x.stars === filt) : r;
  return (
    <section className={s.sec} id="reviews">
      <div className={s.secH}>
        <h2>
          {t('heading')}{' '}
          <span className={cn(s.muted, 'num')} style={{ fontWeight: 400 }}>
            ({r.length})
          </span>
        </h2>
        <button
          className={cn(s.btn, s.btnGhost, s.btnSm)}
          onClick={() => needAuth('writeReview', () => writeReview(itemId))}
        >
          {t('write')}
        </button>
      </div>
      <div className={cn(s.panel, s.glassMat)}>
        <div className={s.rvTop}>
          <div style={{ textAlign: 'center' }}>
            <div className={cn(s.rvBig, 'num')}>{avg.toFixed(1)}</div>
            <StarRow n={Math.round(avg)} size={14} />
            <div className={cn(s.small, s.muted)}>{t('count', { count: r.length })}</div>
          </div>
          <div className={s.bars}>
            {[5, 4, 3, 2, 1].map((n) => {
              const c = r.filter((x) => x.stars === n).length;
              return (
                <div key={n} className={s.rbar}>
                  <span className="num">{n}★</span>
                  <i>
                    <b style={{ width: `${r.length ? (c / r.length) * 100 : 0}%` }} />
                  </i>
                  <span className="num">{c}</span>
                </div>
              );
            })}
          </div>
          <div className={cn(s.chips, s.chipsWrap)} style={{ alignSelf: 'start' }}>
            {[0, 5, 4, 3].map((n) => (
              <button
                key={n}
                className={cn(s.chip, s.chipSm, filt === n && s.on)}
                onClick={() => {
                  setFilt(n);
                  document.getElementById('reviews')?.scrollIntoView({ block: 'start' });
                }}
              >
                {n ? `${n}★` : t('all')}
              </button>
            ))}
          </div>
        </div>
        <div>
          {list.length ? (
            list.map((x) => <ReviewItem key={x.key} r={x} shopName={shopName} />)
          ) : (
            <p className={s.muted} style={{ padding: '12px 0' }}>
              {t('noneWithRating')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
