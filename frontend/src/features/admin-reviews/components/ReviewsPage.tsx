'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  chipsFor,
  DataTable,
  dataStyles,
  DateRangeFilter,
  ExportButton,
  FilterBar,
  Pagination,
  SegmentFilter,
  SelectFilter,
  useListQuery,
  useRangeLabel,
  type Column,
} from '@/components/data';
import { adminApi, type BulkResult, useAdminAction, useReviews } from '@/features/admin-shared/api';
import { PageHead, Pill } from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type { ReviewRow } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s, Stars } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

const KEYS = ['q', 'status', 'stars', 'businessId', 'replied', 'from', 'to'] as const;

/** `/admin/reviews`: moderation. Hiding takes a review out of public lists and ratings. */
export function ReviewsPage() {
  const t = useTranslations('admin.reviews');
  const ta = useTranslations('admin');
  const tl = useTranslations('admin.lists');
  const f = useAdminFmt();
  const list = useListQuery(KEYS, { sort: '-at' });
  const { values: v } = list;
  const { data, isPending, isFetching, error, refetch } = useReviews(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const rangeLabel = useRangeLabel(tl('posted'));

  const hide = (r: ReviewRow) =>
    act({
      title: t('hideTitle', { name: r.authorName }),
      body: t('hideBody'),
      ok: t('hide'),
      danger: true,
      reason: 'required',
      done: t('hidden'),
      run: (why) => run.mutateAsync(() => adminApi.hideReview(r.id, why)),
    });
  const restore = (r: ReviewRow) =>
    act({
      title: t('restoreTitle', { name: r.authorName }),
      ok: t('restore'),
      done: t('restored'),
      run: () => run.mutateAsync(() => adminApi.restoreReview(r.id)),
    });
  const bulk = (action: 'hide' | 'restore') =>
    void act<BulkResult>({
      title: tl(`bulk.reviews.${action}Title`, { n: sel.size }),
      body: tl(`bulk.reviews.${action}Body`),
      ok: tl(`bulk.reviews.${action}`),
      ...(action === 'hide' ? { danger: true, reason: 'required' as const } : {}),
      done: (r) =>
        r.failed.length
          ? tl('bulk.partly', { done: r.done, failed: r.failed.length })
          : tl('bulk.done', { n: r.done }),
      run: (reason) =>
        run.mutateAsync(() =>
          adminApi.bulk('reviews', [...sel], action, reason || undefined),
        ) as Promise<BulkResult>,
    }).then((r) => r && setSel(new Set(r.failed.map((x) => x.id))));

  const columns: Column<ReviewRow>[] = [
    {
      key: 'review',
      header: tl('review'),
      sort: 'stars',
      cell: (r) => (
        <div style={{ display: 'grid', gap: 4, maxWidth: 520, opacity: r.hiddenAt ? 0.7 : 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Stars n={r.stars} />
            <strong>{r.authorName}</strong>
            {r.verified && <Pill tone="ok">{t('verified')}</Pill>}
            {r.hiddenAt && <Pill tone="bad">{t('hiddenPill')}</Pill>}
          </div>
          {r.text && <p style={{ margin: 0, whiteSpace: 'normal' }}>{r.text}</p>}
          {r.tags.length > 0 && <span className={cx(s.tiny, s.muted)}>{r.tags.join(' · ')}</span>}
          {r.reply && (
            <p className={cx(s.small, s.muted)} style={{ margin: 0 }}>
              {t('reply', { text: r.reply })}
            </p>
          )}
          {r.hiddenAt && (
            <span className={cx(s.small, s.dangerText)}>
              {t('hiddenBecause', { reason: r.hiddenReason ?? '', date: f.date(r.hiddenAt) })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'shop',
      header: tl('shopItem'),
      cell: (r) => (
        <>
          <Link href={`/admin/shops/${r.businessId}`}>{r.shopName}</Link>
          {r.itemName && <span className={cx(s.tiny, s.muted, s.block)}>{r.itemName}</span>}
        </>
      ),
    },
    {
      key: 'at',
      header: tl('posted'),
      sort: 'at',
      sortFirst: 'desc',
      cell: (r) => <span className={s.num}>{f.date(r.at)}</span>,
    },
    {
      key: 'act',
      header: <span className={dataStyles.srOnly}>{tl('actions')}</span>,
      align: 'right',
      cell: (r) => (
        <button
          type="button"
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          onClick={() => void (r.hiddenAt ? restore(r) : hide(r))}
        >
          {r.hiddenAt ? t('restore') : t('hide')}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={t('title')}
        sub={data ? t('sub', { n: data.total }) : undefined}
        actions={
          <ExportButton
            path={`/admin/reviews/export?${list.apiQuery()}`}
            className={cx(s.btn, s.btnGhost)}
          />
        }
      />
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <SegmentFilter
          label={t('statusLabel')}
          value={v.status}
          onChange={(status) => list.set({ status })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'low', label: t('filter.low') },
            { value: 'visible', label: t('filter.visible') },
            { value: 'hidden', label: t('filter.hidden') },
          ]}
        />
        <FilterBar
          views="admin.reviews"
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chipsFor(
            list,
            {
              stars: (x) => `${t('starsLabel')}: ${'★'.repeat(Number(x))}`,
              replied: (x) => `${tl('replied')}: ${tl(`repliedOpt.${x}` as 'repliedOpt.yes')}`,
              businessId: () => tl('oneShop'),
            },
            rangeLabel,
          )}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('starsLabel')}
            value={v.stars}
            onChange={(stars) => list.set({ stars })}
            options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: '★'.repeat(n) }))}
          />
          <SelectFilter
            label={tl('replied')}
            value={v.replied}
            onChange={(replied) => list.set({ replied })}
            options={(['yes', 'no'] as const).map((x) => ({
              value: x,
              label: tl(`repliedOpt.${x}`),
            }))}
          />
          <DateRangeFilter
            label={tl('posted')}
            from={v.from}
            to={v.to}
            onChange={(from, to) => list.set({ from, to })}
          />
        </FilterBar>
      </div>
      <section className={s.panel}>
        <DataTable
          label={t('title')}
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={{ title: t('empty'), body: tl('emptyBody') }}
          sort={list.sort}
          onSort={list.toggleSort}
          selected={sel}
          onSelect={setSel}
          bulk={
            <>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('hide')}
              >
                {tl('bulk.reviews.hide')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('restore')}
              >
                {tl('bulk.reviews.restore')}
              </button>
            </>
          }
        />
        {data && (
          <Pagination
            page={list.page}
            size={list.size}
            total={data.total}
            onPage={(page) => list.set({ page })}
            onSize={(size) => list.set({ size })}
          />
        )}
      </section>
    </>
  );
}
