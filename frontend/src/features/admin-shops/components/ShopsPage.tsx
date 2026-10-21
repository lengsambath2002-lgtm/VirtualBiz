'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  chipsFor,
  DataTable,
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
import {
  adminApi,
  type BulkResult,
  useAdminAction,
  useCategories,
  useShops,
} from '@/features/admin-shared/api';
import { Avatar, PageHead, Pill, VerificationPill } from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type { ShopRow } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s } from '@/features/seller-shared';
import { useDistricts } from '@/lib/hooks/useDistricts';
import { useRouter } from '@/lib/i18n/navigation';

const KEYS = ['q', 'type', 'verification', 'status', 'category', 'district', 'from', 'to'] as const;

/** `/admin/shops`: every business, the ID-check queue one tab away, bulk decisions and export. */
export function ShopsPage() {
  const t = useTranslations('admin.shops');
  const ta = useTranslations('admin');
  const tl = useTranslations('admin.lists');
  const f = useAdminFmt();
  const router = useRouter();
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const list = useListQuery(KEYS, { sort: '-created' });
  const { values: v } = list;
  const { data, isPending, isFetching, error, refetch } = useShops(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const { data: cats } = useCategories();
  const { data: districts } = useDistricts();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const rangeLabel = useRangeLabel(t('col.joined'));

  const bulk = (action: 'verify' | 'reject' | 'suspend' | 'reinstate') =>
    void act<BulkResult>({
      title: tl(`bulk.shops.${action}Title`, { n: sel.size }),
      body: tl(`bulk.shops.${action}Body`),
      ok: tl(`bulk.shops.${action}`),
      ...(action === 'reject' || action === 'suspend'
        ? { danger: true, reason: 'required' as const }
        : { reason: 'optional' as const }),
      done: (r) =>
        r.failed.length
          ? tl('bulk.partly', { done: r.done, failed: r.failed.length })
          : tl('bulk.done', { n: r.done }),
      run: (reason) =>
        run.mutateAsync(() =>
          adminApi.bulk('businesses', [...sel], action, reason || undefined),
        ) as Promise<BulkResult>,
    }).then((r) => r && setSel(new Set(r.failed.map((x) => x.id))));

  const columns: Column<ShopRow>[] = [
    {
      key: 'shop',
      header: t('col.shop'),
      sort: 'name',
      cell: (b) => (
        <div className={s.cw}>
          <Avatar name={b.name} url={b.logoUrl} size={34} square />
          <div style={{ minWidth: 0 }}>
            <div className={s.who}>{b.name}</div>
            <span className={cx(s.tiny, s.muted)}>
              {ta(`type.${b.type}`)} · {b.district}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: t('col.owner'),
      hideNarrow: true,
      cell: (b) => (
        <>
          <div>{b.ownerName}</div>
          <span className={cx(s.tiny, s.muted)}>{b.ownerContact}</span>
        </>
      ),
    },
    {
      key: 'check',
      header: t('col.check'),
      cell: (b) => (
        <>
          <VerificationPill v={b.verification} />
          {b.verification === 'PENDING' && !b.hasIdPhoto && (
            <span className={cx(s.tiny, s.muted, s.block)}>{t('noPhoto')}</span>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      cell: (b) =>
        b.suspendedAt ? (
          <Pill tone="bad">{t('status.suspended')}</Pill>
        ) : b.online ? (
          <Pill tone="ok">{t('status.active')}</Pill>
        ) : (
          <Pill tone="neutral">{t('status.offline')}</Pill>
        ),
    },
    {
      key: 'gmv',
      header: t('col.gmv30'),
      sort: 'gmv',
      sortFirst: 'desc',
      align: 'right',
      cell: (b) => (
        <span className={s.num}>
          {f.money0(b.gmv30)}
          <span className={cx(s.tiny, s.muted, s.block)}>{t('ordersN', { n: b.orders30 })}</span>
        </span>
      ),
    },
    {
      key: 'rating',
      header: t('col.rating'),
      sort: 'rating',
      sortFirst: 'desc',
      align: 'right',
      hideNarrow: true,
      cell: (b) => (
        <span className={s.num}>
          {b.reviewCount ? `★ ${b.rating.toFixed(1)}` : '—'}
          <span className={cx(s.tiny, s.muted, s.block)}>{b.reviewCount}</span>
        </span>
      ),
    },
    {
      key: 'joined',
      header: t('col.joined'),
      sort: 'created',
      sortFirst: 'desc',
      cell: (b) => <span className={s.num}>{f.date(b.createdAt)}</span>,
    },
  ];

  const catName = (id: string) => cats?.find((c) => c.id === id)?.name ?? id;
  const chips = chipsFor(
    list,
    {
      type: (x) => `${t('typeLabel')}: ${ta(`type.${x}` as 'type.PRODUCT')}`,
      status: (x) => `${t('statusLabel')}: ${t(`status.${x}` as 'status.active')}`,
      category: (x) => `${tl('category')}: ${catName(x)}`,
      district: (x) => `${tl('district')}: ${x}`,
    },
    rangeLabel,
  );

  return (
    <>
      <PageHead
        title={t('title')}
        sub={data ? t('sub', { n: data.total }) : undefined}
        actions={
          <ExportButton
            path={`/admin/businesses/export?${list.apiQuery()}`}
            className={cx(s.btn, s.btnGhost)}
          />
        }
      />
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <SegmentFilter
          label={t('verificationLabel')}
          value={v.verification}
          onChange={(verification) =>
            list.set({ verification, sort: verification === 'PENDING' ? 'created' : null })
          }
          options={[
            { value: '', label: ta('common.all') },
            { value: 'PENDING', label: tl('queue') },
            { value: 'VERIFIED', label: ta('verification.VERIFIED') },
            { value: 'REJECTED', label: ta('verification.REJECTED') },
          ]}
        />
        <FilterBar
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chips}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('statusLabel')}
            value={v.status}
            onChange={(status) => list.set({ status })}
            options={(['active', 'offline', 'suspended'] as const).map((x) => ({
              value: x,
              label: t(`status.${x}`),
            }))}
          />
          <SelectFilter
            label={t('typeLabel')}
            value={v.type}
            onChange={(type) => list.set({ type, category: '' })}
            options={(['PRODUCT', 'SERVICE'] as const).map((x) => ({
              value: x,
              label: ta(`type.${x}`),
            }))}
          />
          <SelectFilter
            label={tl('category')}
            value={v.category}
            onChange={(category) => list.set({ category })}
            options={(cats ?? [])
              .filter((c) => !v.type || c.businessType === v.type)
              .map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectFilter
            label={tl('district')}
            value={v.district}
            onChange={(district) => list.set({ district })}
            options={(districts ?? []).map((d) => ({ value: d.name, label: d.name }))}
          />
          <DateRangeFilter
            label={t('col.joined')}
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
          rowKey={(b) => b.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={{ title: t('empty'), body: t('emptySub') }}
          sort={list.sort}
          onSort={list.toggleSort}
          selected={sel}
          onSelect={setSel}
          onRow={(b) => router.push(`/admin/shops/${b.id}`)}
          bulk={
            <>
              <button
                type="button"
                className={cx(s.btn, s.btnPrimary, s.btnSm)}
                onClick={() => bulk('verify')}
              >
                {tl('bulk.shops.verify')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('reject')}
              >
                {tl('bulk.shops.reject')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('suspend')}
              >
                {tl('bulk.shops.suspend')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('reinstate')}
              >
                {tl('bulk.shops.reinstate')}
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
