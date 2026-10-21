'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

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
import { toAppointment } from '@/features/provider-shared/api';
import { StatusPill } from '@/features/provider-shared/components/Bits';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import type { ProviderAppointment } from '@/features/provider-shared/types';
import { fmtDay2Month, hm } from '@/features/provider-shared/util/time';
import { api, type ApiAppointment } from '@/lib/api';
import type { AppointmentStatus } from '@/lib/domain';
import { rangeOf } from '@/lib/utils/dateRange';

const KEYS = ['q', 'status', 'staffId', 'serviceId', 'source', 'from', 'to'] as const;
const STATUSES: AppointmentStatus[] = [
  'REQUESTED',
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'STARTED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
  'DECLINED',
];
const SOURCES = ['ONLINE', 'PHONE', 'WALK_IN'] as const;

/**
 * The calendar as a list (docs/api/phase16-shop-lists.md): every appointment, any period, filtered
 * by status, staff, service and source, sorted and paged on the server. Requests can be accepted
 * several at once.
 */
export function AppointmentList({ bar }: { bar: React.ReactNode }) {
  const f = useFmt();
  const { t, locale } = f;
  const tl = useTranslations('apptList');
  const d = useData();
  const ui = useUi();
  const list = useListQuery(KEYS, { sort: '-when' });
  const { values: v } = list;
  const query = list.apiQuery();
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['apptList', d.business.id, query],
    queryFn: async () => {
      const p = await api.get<{ items: ApiAppointment[]; total: number }>(
        `/appointments/list?${query}`,
        { businessId: d.business.id },
      );
      return { ...p, items: p.items.map(toAppointment) };
    },
    placeholderData: keepPreviousData,
  });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const rangeLabel = useRangeLabel(tl('when'));
  const span = v.from && v.to ? { from: v.from, to: v.to } : rangeOf('last365');

  const open = (a: ProviderAppointment) => {
    useProviderStore.getState().update((dd) => {
      if (!dd.appointments.some((x) => x.id === a.id)) dd.appointments.push(a);
    });
    ui.open({ t: 'appt', id: a.id });
  };
  const clientName = (id: string) => d.clients.find((c) => c.id === id)?.name ?? '—';
  const staffName = (id: string) => d.staff.find((m) => m.id === id)?.name ?? '—';
  const serviceName = (id: string) => d.services.find((s) => s.id === id)?.name ?? '—';

  const requests = (data?.items ?? []).filter((a) => sel.has(a.id) && a.status === 'REQUESTED');
  const acceptAll = async () => {
    const res = await api.post<{ done: number; failed: { id: string }[] }>(
      '/appointments/bulk-status',
      { refs: requests.map((a) => a.id), status: { status: 'BOOKED' } },
      { businessId: d.business.id },
    );
    ui.showToast(
      res.failed.length
        ? tl('acceptedSome', { done: res.done, failed: res.failed.length })
        : tl('accepted', { n: res.done }),
    );
    setSel(new Set());
    void refetch();
    // The workspace's own copy (calendar, home) shows the new statuses at once.
    useProviderStore.getState().update((dd) => {
      for (const a of dd.appointments)
        if (requests.some((r) => r.id === a.id) && !res.failed.some((x) => x.id === a.id))
          a.status = 'BOOKED';
    });
  };

  const columns: Column<ProviderAppointment>[] = [
    {
      key: 'when',
      header: tl('when'),
      sort: 'when',
      sortFirst: 'desc',
      cell: (a) => (
        <span className={k('num')}>
          {fmtDay2Month(a.date, locale)}, {hm(a.start)}
          <span className={k('tiny muted')} style={{ display: 'block' }}>
            {a.number}
          </span>
        </span>
      ),
    },
    { key: 'client', header: t('sales.thClient'), cell: (a) => clientName(a.clientId) },
    { key: 'service', header: tl('service'), cell: (a) => serviceName(a.serviceId) },
    { key: 'staff', header: tl('staff'), hideNarrow: true, cell: (a) => staffName(a.staffId) },
    { key: 'status', header: tl('status'), cell: (a) => <StatusPill status={a.status} /> },
    {
      key: 'source',
      header: tl('source'),
      hideNarrow: true,
      cell: (a) => tl(`sourceOpt.${a.source}` as 'sourceOpt.ONLINE'),
    },
    {
      key: 'price',
      header: tl('price'),
      sort: 'price',
      sortFirst: 'desc',
      align: 'right',
      cell: (a) => <span className={k('num')}>{f.money(a.price)}</span>,
    },
  ];

  return (
    <>
      {bar}
      <div style={{ display: 'grid', gap: 12, margin: '12px 0' }}>
        <FilterBar
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={tl('searchPh')}
          label={tl('searchLabel')}
          active={chipsFor(
            list,
            {
              status: (x) => `${tl('status')}: ${t(`status.${x}` as 'status.BOOKED')}`,
              staffId: (x) => `${tl('staff')}: ${staffName(x)}`,
              serviceId: (x) => `${tl('service')}: ${serviceName(x)}`,
              source: (x) => `${tl('source')}: ${tl(`sourceOpt.${x}` as 'sourceOpt.ONLINE')}`,
            },
            rangeLabel,
          )}
          onClearAll={list.reset}
          actions={
            <ExportButton
              path={`/exports/appointments?${new URLSearchParams(span)}`}
              businessId={d.business.id}
              className={k('btn btn-ghost btn-sm')}
            />
          }
        >
          <SelectFilter
            label={tl('status')}
            value={v.status}
            onChange={(status) => list.set({ status })}
            options={STATUSES.map((x) => ({ value: x, label: t(`status.${x}`) }))}
          />
          <SelectFilter
            label={tl('staff')}
            value={v.staffId}
            onChange={(staffId) => list.set({ staffId })}
            options={d.staff.map((m) => ({ value: m.id, label: m.name }))}
          />
          <SelectFilter
            label={tl('service')}
            value={v.serviceId}
            onChange={(serviceId) => list.set({ serviceId })}
            options={d.services.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectFilter
            label={tl('source')}
            value={v.source}
            onChange={(source) => list.set({ source })}
            options={SOURCES.map((x) => ({ value: x, label: tl(`sourceOpt.${x}`) }))}
          />
          <DateRangeFilter
            label={tl('when')}
            from={v.from}
            to={v.to}
            onChange={(from, to) => list.set({ from, to })}
          />
        </FilterBar>
      </div>
      <section className={k('panel')}>
        <DataTable
          label={tl('title')}
          columns={columns}
          rows={data?.items}
          rowKey={(a) => a.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={
            list.active.length
              ? { title: tl('noMatch'), body: tl('noMatchBody') }
              : { title: tl('empty') }
          }
          sort={list.sort}
          onSort={list.toggleSort}
          selected={sel}
          onSelect={setSel}
          bulk={
            <button
              type="button"
              className={k('btn btn-primary btn-sm')}
              disabled={!requests.length}
              onClick={() => void acceptAll()}
            >
              {tl('acceptN', { n: requests.length })}
            </button>
          }
          onRow={open}
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
