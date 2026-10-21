'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import {
  chipsFor,
  DataTable,
  DateRangeFilter,
  ExportButton,
  FilterBar,
  ImportDialog,
  Pagination,
  SegmentFilter,
  SelectFilter,
  useListQuery,
  useRangeLabel,
  type Column,
  type ImportReport,
} from '@/components/data';
import { api, type ApiClient } from '@/lib/api';
import type { BusinessType } from '@/lib/domain';
import { useDistricts } from '@/lib/hooks/useDistricts';
import { formatUsd } from '@/lib/money';
import { formatPhone } from '@/lib/utils/phone';

import c$ from './customers.module.css';
import { EditCustomerDialog } from './EditCustomerDialog';

/** A customer with lifetime numbers (`GET /api/clients/page`, docs/api/phase16-shop-lists.md). */
export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  district?: string | null;
  note?: string | null;
  since: string;
  userId?: string | null;
  orders: number;
  visits: number;
  noShows: number;
  spent: number;
  lastAt?: string | null;
  nextVisit?: string | null;
  segment?: 'vip' | 'new' | 'risk' | null;
}

interface Page {
  items: CustomerRow[];
  total: number;
  page: number;
  size: number;
}

const KEYS = ['q', 'segment', 'district', 'account', 'from', 'to'] as const;

const IMPORT_COLUMNS = [
  { name: 'Name', required: true },
  { name: 'Phone', required: true },
  { name: 'Email' },
  { name: 'District' },
  { name: 'Note' },
];

/**
 * The shop's customers (both workspaces): every customer a page at a time from the API with
 * lifetime orders or visits and spend, segments, filters kept in the URL, add and edit, CSV import
 * and export. `onOpen` shows the workspace's own customer panel.
 */
export function CustomerList({
  businessId,
  type,
  canManage,
  onOpen,
  onSaved,
  title,
  sub,
}: {
  businessId: string;
  type: BusinessType;
  /** Owners and managers import and export (the files hold customers' details). */
  canManage: boolean;
  onOpen: (row: CustomerRow) => void;
  /** A customer added, edited or imported: the workspace refreshes its own copy. */
  onSaved?: (c?: ApiClient) => void;
  title: string;
  sub?: (total: number) => ReactNode;
}) {
  const t = useTranslations('customerList');
  const qc = useQueryClient();
  const list = useListQuery(KEYS, { sort: type === 'SERVICE' ? '-last' : '-spent' });
  const { values: v } = list;
  const query = list.apiQuery();
  const key = ['customers', businessId, query];
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Page>(`/clients/page?${query}`, { businessId }),
    placeholderData: keepPreviousData,
  });
  const { data: districts } = useDistricts();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const rangeLabel = useRangeLabel(t('since'));
  const service = type === 'SERVICE';
  const refresh = () => void qc.invalidateQueries({ queryKey: ['customers', businessId] });
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: t('col.customer'),
      sort: 'name',
      cell: (r) => (
        <span className={c$.who}>
          <strong>
            {r.name}
            {r.segment && (
              <span className={`${c$.tag} ${c$[`tag_${r.segment}`]}`}>
                {t(`segment.${r.segment}`)}
              </span>
            )}
          </strong>
          <span className={c$.sub}>
            {formatPhone(r.phone)}
            {r.email ? ` · ${r.email}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'district',
      header: t('col.district'),
      hideNarrow: true,
      cell: (r) => r.district ?? '—',
    },
    service
      ? {
          key: 'visits',
          header: t('col.visits'),
          sort: 'visits',
          sortFirst: 'desc',
          align: 'right',
          cell: (r) => (
            <span className={c$.num}>
              {r.visits}
              {r.noShows > 0 && <span className={c$.sub}>{t('noShows', { n: r.noShows })}</span>}
            </span>
          ),
        }
      : {
          key: 'orders',
          header: t('col.orders'),
          sort: 'orders',
          sortFirst: 'desc',
          align: 'right',
          cell: (r) => <span className={c$.num}>{r.orders}</span>,
        },
    {
      key: 'spent',
      header: t('col.spent'),
      sort: 'spent',
      sortFirst: 'desc',
      align: 'right',
      cell: (r) => <span className={c$.num}>{formatUsd(r.spent)}</span>,
    },
    {
      key: 'last',
      header: service ? t('col.lastVisit') : t('col.lastOrder'),
      sort: 'last',
      sortFirst: 'desc',
      cell: (r) => (
        <span className={c$.num}>
          {r.lastAt ? fmtDay(r.lastAt) : '—'}
          {service && r.nextVisit && (
            <span className={c$.sub}>{t('next', { date: fmtDay(r.nextVisit) })}</span>
          )}
        </span>
      ),
    },
    {
      key: 'since',
      header: t('since'),
      sort: 'since',
      sortFirst: 'desc',
      hideNarrow: true,
      cell: (r) => <span className={c$.num}>{fmtDay(r.since)}</span>,
    },
  ];

  const segments = service
    ? (['vip', 'new', 'risk', 'noshow'] as const)
    : (['vip', 'new'] as const);

  return (
    <>
      <div className={c$.head}>
        <div>
          <h1>{title}</h1>
          {data && sub && <p>{sub(data.total)}</p>}
        </div>
        <div className={c$.headActs}>
          {canManage && (
            <>
              <ExportButton
                path="/exports/customers"
                businessId={businessId}
                className={c$.ghost}
              />
              <button type="button" className={c$.ghost} onClick={() => setImporting(true)}>
                {t('import')}
              </button>
            </>
          )}
          <button type="button" className={c$.primary} onClick={() => setAdding(true)}>
            {t('add')}
          </button>
        </div>
      </div>
      <div className={c$.filters}>
        <SegmentFilter
          label={t('segmentLabel')}
          value={v.segment}
          onChange={(segment) => list.set({ segment })}
          options={[
            { value: '', label: t('all') },
            ...segments.map((x) => ({ value: x, label: t(`segment.${x}`) })),
          ]}
        />
        <FilterBar
          views="customers"
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chipsFor(
            list,
            {
              district: (x) => `${t('col.district')}: ${x}`,
              account: (x) => `${t('account')}: ${t(`accountOpt.${x}` as 'accountOpt.yes')}`,
            },
            rangeLabel,
          )}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('col.district')}
            value={v.district}
            onChange={(district) => list.set({ district })}
            options={(districts ?? []).map((d) => ({ value: d.name, label: d.name }))}
          />
          <SelectFilter
            label={t('account')}
            value={v.account}
            onChange={(account) => list.set({ account })}
            options={(['yes', 'no'] as const).map((x) => ({
              value: x,
              label: t(`accountOpt.${x}`),
            }))}
          />
          <DateRangeFilter
            label={t('since')}
            from={v.from}
            to={v.to}
            onChange={(from, to) => list.set({ from, to })}
          />
        </FilterBar>
      </div>
      <section className={c$.panel}>
        <DataTable
          label={title}
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={
            list.active.length
              ? { title: t('noMatch'), body: t('noMatchBody') }
              : { title: t('emptyTitle'), body: t('emptyBody') }
          }
          sort={list.sort}
          onSort={list.toggleSort}
          onRow={onOpen}
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
      {adding && (
        <EditCustomerDialog
          businessId={businessId}
          customer={{ clientId: '', name: '', phone: '' }}
          onClose={() => setAdding(false)}
          onSaved={(c) => {
            refresh();
            onSaved?.(c);
          }}
        />
      )}
      {importing && (
        <ImportDialog
          title={t('importTitle')}
          columns={IMPORT_COLUMNS.map((col) => ({
            ...col,
            hint: t(`importHint.${col.name}` as 'importHint.Name'),
          }))}
          example={['Sok Dara', '012 345 678', 'dara@example.com', 'Daun Penh', '']}
          templateName="customers-template.csv"
          run={(rows, o) =>
            api.post<ImportReport>(
              `/imports/customers?dryRun=${o.dryRun}&skipInvalid=${o.skipInvalid}`,
              { rows },
              { businessId },
            )
          }
          onClose={() => setImporting(false)}
          onDone={() => {
            refresh();
            onSaved?.();
          }}
        />
      )}
    </>
  );
}
