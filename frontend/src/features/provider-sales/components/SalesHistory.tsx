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
import { toSale } from '@/features/provider-shared/api';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import type { ProviderSale } from '@/features/provider-shared/types';
import { fmtShortStamp } from '@/features/provider-shared/util/time';
import { api, type ApiSale } from '@/lib/api';
import { rangeOf } from '@/lib/utils/dateRange';

const KEYS = ['q', 'pay', 'refunded', 'from', 'to'] as const;
const PAYS = ['CASH', 'KHQR', 'CARD'] as const;

/**
 * Every sale, a page at a time from the API (docs/api/phase16-shop-lists.md): search by receipt
 * number or client, payment and date filters, sort, and a CSV of the period.
 */
export function SalesHistory() {
  const f = useFmt();
  const { t, locale } = f;
  const th = useTranslations('salesHistory');
  const d = useData();
  const ui = useUi();
  const list = useListQuery(KEYS, { sort: '-at' });
  const { values: v } = list;
  const query = list.apiQuery();
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['salesHistory', d.business.id, query],
    queryFn: async () => {
      const p = await api.get<{ items: ApiSale[]; total: number }>(`/sales/history?${query}`, {
        businessId: d.business.id,
      });
      return { ...p, items: p.items.map(toSale) };
    },
    placeholderData: keepPreviousData,
  });
  const rangeLabel = useRangeLabel(t('sales.thDate'));
  const span = v.from && v.to ? { from: v.from, to: v.to } : rangeOf('last365');

  const open = (s: ProviderSale) => {
    useProviderStore.getState().update((dd) => {
      if (!dd.sales.some((x) => x.id === s.id)) dd.sales.push(s);
    });
    ui.open({ t: 'receipt', saleId: s.id });
  };

  const columns: Column<ProviderSale>[] = [
    {
      key: 'at',
      header: t('sales.thDate'),
      sort: 'at',
      sortFirst: 'desc',
      cell: (s) => (
        <span className={k('num')}>
          {fmtShortStamp(s.at, locale)}
          <span className={k('tiny muted')} style={{ display: 'block' }}>
            {s.number}
          </span>
        </span>
      ),
    },
    {
      key: 'client',
      header: t('sales.thClient'),
      cell: (s) => {
        const c = s.customerId ? d.clients.find((x) => x.id === s.customerId) : undefined;
        return c ? c.name : <span className={k('muted')}>{t('sales.walkin')}</span>;
      },
    },
    {
      key: 'items',
      header: t('sales.thItems'),
      hideNarrow: true,
      cell: (s) => s.lines.map((i) => i.title).join(', '),
    },
    {
      key: 'pay',
      header: t('sales.thPayment'),
      cell: (s) => (
        <span className={k('pill neutral')}>{f.pay(s.payments[0]?.method ?? 'CASH')}</span>
      ),
    },
    {
      key: 'tip',
      header: t('sales.thTip'),
      align: 'right',
      hideNarrow: true,
      cell: (s) => <span className={k('num')}>{s.tip ? f.money(s.tip) : '–'}</span>,
    },
    {
      key: 'total',
      header: t('sales.thTotal'),
      sort: 'total',
      sortFirst: 'desc',
      align: 'right',
      cell: (s) => <b className={k('num')}>{f.money(s.total)}</b>,
    },
  ];

  return (
    <section className={k('panel')}>
      <div className={k('panel-h')} style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2>{t('sales.transactions')}</h2>
        <ExportButton
          path={`/exports/sales?${new URLSearchParams(span)}`}
          businessId={d.business.id}
          className={k('btn btn-ghost btn-sm')}
        />
      </div>
      <div style={{ padding: '12px 14px 0' }}>
        <FilterBar
          views="provider.sales"
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={th('searchPh')}
          label={th('searchLabel')}
          active={chipsFor(
            list,
            {
              pay: (x) => `${t('sales.thPayment')}: ${f.pay(x as 'CASH')}`,
              refunded: (x) => `${th('refunded')}: ${th(`refundedOpt.${x}` as 'refundedOpt.yes')}`,
            },
            rangeLabel,
          )}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('sales.thPayment')}
            value={v.pay}
            onChange={(pay) => list.set({ pay })}
            options={PAYS.map((p) => ({ value: p, label: f.pay(p) }))}
          />
          <SelectFilter
            label={th('refunded')}
            value={v.refunded}
            onChange={(refunded) => list.set({ refunded })}
            options={(['yes', 'no'] as const).map((x) => ({
              value: x,
              label: th(`refundedOpt.${x}`),
            }))}
          />
          <DateRangeFilter
            label={t('sales.thDate')}
            from={v.from}
            to={v.to}
            onChange={(from, to) => list.set({ from, to })}
          />
        </FilterBar>
      </div>
      <DataTable
        label={t('sales.transactions')}
        columns={columns}
        rows={data?.items}
        rowKey={(s) => s.id}
        loading={isFetching && !isPending}
        error={error}
        retry={() => void refetch()}
        empty={
          list.active.length
            ? { title: th('noMatch'), body: th('noMatchBody') }
            : { title: t('sales.empty') }
        }
        sort={list.sort}
        onSort={list.toggleSort}
        onRow={open}
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
  );
}
