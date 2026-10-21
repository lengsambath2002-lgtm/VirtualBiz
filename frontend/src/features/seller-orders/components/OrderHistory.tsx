'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import {
  chipsFor,
  DataTable,
  DateRangeFilter,
  ExportButton,
  FilterBar,
  Pagination,
  SelectFilter,
  useListQuery,
  useRangeLabel,
  type Column,
} from '@/components/data';
import {
  cx,
  fetchOrderHistory,
  Ic,
  itemCount,
  orderCustomer,
  PayPill,
  s,
  StatusPill,
  useDb,
  useFmt,
  useSellerStore,
  type OrderTab,
  type SellerOrder,
} from '@/features/seller-shared';
import { rangeOf } from '@/lib/utils/dateRange';

import { useOrderActions } from '../hooks/useOrderActions';
import { SourcePill } from './SourcePill';

const KEYS = ['q', 'method', 'pay', 'source', 'from', 'to'] as const;
const SOURCES = ['ONLINE', 'PHONE', 'FACEBOOK', 'TELEGRAM', 'WALK_IN'] as const;

/**
 * Done, cancelled and all orders (docs/api/phase16-shop-lists.md): every order the shop ever had,
 * a page at a time from the API, with search, filters, sort and a CSV of exactly this view.
 */
export function OrderHistory({ tab }: { tab: Extract<OrderTab, 'done' | 'cancelled' | 'all'> }) {
  const t = useTranslations('seller.orders');
  const tm = useTranslations('seller.method');
  const th = useTranslations('seller.orderHistory');
  const tsrc = useTranslations('seller.manual.source');
  const db = useDb();
  const f = useFmt();
  const act = useOrderActions();
  const list = useListQuery(KEYS, { sort: '-placed' });
  const { values: v } = list;
  const query = list.apiQuery({ tab });
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['seller', 'orderHistory', db.shop.id, query],
    queryFn: () => fetchOrderHistory(db.shop.id, query),
    placeholderData: keepPreviousData,
  });
  const rangeLabel = useRangeLabel(th('placed'));

  const open = (o: SellerOrder) => {
    useSellerStore.getState().rememberOrders([o]);
    act.open(o.id);
  };
  // The export takes up to a year: the list's dates, or the last 12 months.
  const span = v.from && v.to ? { from: v.from, to: v.to } : rangeOf('last365');
  const exportQuery = new URLSearchParams(
    Object.entries({ tab, q: v.q, method: v.method, pay: v.pay, source: v.source, ...span }).filter(
      ([, x]) => x,
    ) as [string, string][],
  ).toString();

  const columns: Column<SellerOrder>[] = [
    {
      key: 'order',
      header: t('col.order'),
      sort: 'number',
      cell: (o) => (
        <>
          <b className={s.num}>{o.number}</b>
          <div className={cx(s.tiny, s.muted)}>{f.fmtDT(o.createdAt)}</div>
        </>
      ),
    },
    {
      key: 'customer',
      header: t('col.customer'),
      cell: (o) => {
        const c = orderCustomer(db, o);
        return (
          <>
            {c.name}
            <div className={cx(s.tiny, s.muted)}>{c.district}</div>
          </>
        );
      },
    },
    {
      key: 'items',
      header: t('col.items'),
      hideNarrow: true,
      cell: (o) => (
        <span className={s.small}>
          {o.lines[0]?.title}
          {o.lines.length > 1 && <span className={s.muted}> +{o.lines.length - 1}</span>}
          <span className={cx(s.tiny, s.muted, s.block)}>{t('items', { n: itemCount(o) })}</span>
        </span>
      ),
    },
    {
      key: 'method',
      header: t('col.delivery'),
      hideNarrow: true,
      cell: (o) => (
        <span className={cx(s.pill, s.neutral)}>
          <Ic name={o.method === 'PICKUP' ? 'store' : 'truck'} size={12} /> {tm(o.method)}
        </span>
      ),
    },
    { key: 'pay', header: t('col.payment'), cell: (o) => <PayPill o={o} /> },
    {
      key: 'status',
      header: t('col.status'),
      cell: (o) => (
        <>
          <StatusPill status={o.status} /> <SourcePill o={o} />
        </>
      ),
    },
    {
      key: 'total',
      header: t('col.total'),
      sort: 'total',
      sortFirst: 'desc',
      align: 'right',
      cell: (o) => <b className={s.num}>{f.money(o.total)}</b>,
    },
    {
      key: 'placed',
      header: th('placed'),
      sort: 'placed',
      sortFirst: 'desc',
      hideNarrow: true,
      cell: (o) => <span className={s.num}>{f.fmtD(o.createdAt)}</span>,
    },
  ];

  return (
    <>
      <FilterBar
        views="seller.orders"
        q={v.q}
        onQ={(q) => list.set({ q })}
        placeholder={t('searchPh')}
        label={t('searchLabel')}
        active={chipsFor(
          list,
          {
            method: (x) => `${t('col.delivery')}: ${tm(x as 'PICKUP')}`,
            pay: (x) => `${t('col.payment')}: ${th(`pay.${x}` as 'pay.CASH')}`,
            source: (x) => `${th('source')}: ${x === 'ONLINE' ? th('online') : tsrc(x as 'PHONE')}`,
          },
          rangeLabel,
        )}
        onClearAll={list.reset}
        actions={
          <ExportButton
            path={`/exports/orders?${exportQuery}`}
            businessId={db.shop.id}
            className={cx(s.btn, s.btnGhost)}
          />
        }
      >
        <SelectFilter
          label={t('col.delivery')}
          value={v.method}
          onChange={(method) => list.set({ method })}
          options={(['DELIVERY', 'PICKUP'] as const).map((x) => ({ value: x, label: tm(x) }))}
        />
        <SelectFilter
          label={t('col.payment')}
          value={v.pay}
          onChange={(pay) => list.set({ pay })}
          options={(['KHQR', 'CARD', 'CASH'] as const).map((x) => ({
            value: x,
            label: th(`pay.${x}`),
          }))}
        />
        <SelectFilter
          label={th('source')}
          value={v.source}
          onChange={(source) => list.set({ source })}
          options={SOURCES.map((x) => ({
            value: x,
            label: x === 'ONLINE' ? th('online') : tsrc(x),
          }))}
        />
        <DateRangeFilter
          label={th('placed')}
          from={v.from}
          to={v.to}
          onChange={(from, to) => list.set({ from, to })}
        />
      </FilterBar>
      <section className={s.panel}>
        <DataTable
          label={t('title')}
          columns={columns}
          rows={data?.items}
          rowKey={(o) => o.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={
            list.active.length
              ? { title: t('empty.noMatch'), body: th('emptyFiltered') }
              : { title: t('empty.none') }
          }
          sort={list.sort}
          onSort={list.toggleSort}
          onRow={open}
          minWidth={860}
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
