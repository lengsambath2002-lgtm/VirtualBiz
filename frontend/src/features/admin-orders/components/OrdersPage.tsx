'use client';

import { useTranslations } from 'next-intl';

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
import { useOrders } from '@/features/admin-shared/api';
import { OrderStatusPill, PageHead, PaymentPill } from '@/features/admin-shared/components/ui';
import type { OrderRow } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s } from '@/features/seller-shared';
import { Link, useRouter } from '@/lib/i18n/navigation';

const KEYS = ['q', 'status', 'businessId', 'customerId', 'method', 'pay', 'from', 'to'] as const;

/** `/admin/orders`: every order on the platform, filtered, sorted, paged and exportable. */
export function OrdersPage() {
  const t = useTranslations('admin.orders');
  const ta = useTranslations('admin');
  const tl = useTranslations('admin.lists');
  const f = useAdminFmt();
  const router = useRouter();
  const list = useListQuery(KEYS, { sort: '-placed', size: 20 });
  const { values: v } = list;
  const { data, isPending, isFetching, error, refetch } = useOrders(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const rangeLabel = useRangeLabel(tl('placed'));
  const scoped = v.businessId || v.customerId;

  const columns: Column<OrderRow>[] = [
    {
      key: 'order',
      header: t('col.order'),
      sort: 'number',
      cell: (o) => (
        <>
          <span className={s.num} style={{ fontWeight: 600 }}>
            {o.number}
          </span>
          <span className={cx(s.tiny, s.muted, s.block)}>{f.dateTime(o.at)}</span>
        </>
      ),
    },
    { key: 'shop', header: t('col.shop'), cell: (o) => o.shopName },
    { key: 'customer', header: t('col.customer'), hideNarrow: true, cell: (o) => o.customerName },
    {
      key: 'method',
      header: tl('fulfilment'),
      hideNarrow: true,
      cell: (o) => tl(`method.${o.method}` as 'method.DELIVERY'),
    },
    { key: 'status', header: t('col.status'), cell: (o) => <OrderStatusPill status={o.status} /> },
    {
      key: 'payment',
      header: t('col.payment'),
      cell: (o) => <PaymentPill method={o.paymentMethod} status={o.paymentStatus} />,
    },
    {
      key: 'total',
      header: t('col.total'),
      sort: 'total',
      sortFirst: 'desc',
      align: 'right',
      cell: (o) => <span className={s.num}>{f.money(o.total)}</span>,
    },
    {
      key: 'placed',
      header: tl('placed'),
      sort: 'placed',
      sortFirst: 'desc',
      hideNarrow: true,
      cell: (o) => <span className={s.num}>{f.date(o.at)}</span>,
    },
  ];

  return (
    <>
      <PageHead
        title={t('title')}
        sub={data ? t('sub', { n: data.total }) : undefined}
        actions={
          <ExportButton
            path={`/admin/orders/export?${list.apiQuery()}`}
            className={cx(s.btn, s.btnGhost)}
          />
        }
      />
      {scoped && (
        <p className={cx(s.small, s.muted)} style={{ marginBottom: 10 }}>
          {v.businessId ? t('scopedShop') : t('scopedCustomer')}{' '}
          <Link href="/admin/orders">{t('clearScope')}</Link>
        </p>
      )}
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <SegmentFilter
          label={t('statusLabel')}
          value={v.status}
          onChange={(status) => list.set({ status })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'open', label: t('filter.open') },
            { value: 'NEW', label: ta('orderStatus.NEW') },
            { value: 'DELIVERED', label: ta('orderStatus.DELIVERED') },
            { value: 'PICKED_UP', label: ta('orderStatus.PICKED_UP') },
            { value: 'CANCELLED', label: ta('orderStatus.CANCELLED') },
            { value: 'RETURNED', label: ta('orderStatus.RETURNED') },
            { value: 'unpaid', label: t('filter.unpaid') },
          ]}
        />
        <FilterBar
          views="admin.orders"
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chipsFor(
            list,
            {
              method: (x) => `${tl('fulfilment')}: ${tl(`method.${x}` as 'method.DELIVERY')}`,
              pay: (x) =>
                `${t('col.payment')}: ${ta(`payment.method.${x}` as 'payment.method.CASH')}`,
            },
            rangeLabel,
          )}
          onClearAll={() => list.set({ q: '', method: '', pay: '', from: '', to: '', status: '' })}
        >
          <SelectFilter
            label={tl('fulfilment')}
            value={v.method}
            onChange={(method) => list.set({ method })}
            options={(['DELIVERY', 'PICKUP'] as const).map((x) => ({
              value: x,
              label: tl(`method.${x}`),
            }))}
          />
          <SelectFilter
            label={t('col.payment')}
            value={v.pay}
            onChange={(pay) => list.set({ pay })}
            options={(['KHQR', 'CARD', 'CASH'] as const).map((x) => ({
              value: x,
              label: ta(`payment.method.${x}`),
            }))}
          />
          <DateRangeFilter
            label={tl('placed')}
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
          rowKey={(o) => o.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={{ title: t('empty'), body: tl('emptyBody') }}
          sort={list.sort}
          onSort={list.toggleSort}
          onRow={(o) => router.push(`/admin/orders/${encodeURIComponent(o.number)}`)}
          minWidth={820}
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
