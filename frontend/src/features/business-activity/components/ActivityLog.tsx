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
import { EmptyView } from '@/components/feedback';
import { useMyRole } from '@/features/account-switcher';
import { useTeam } from '@/features/business-team';
import { api } from '@/lib/api';

import a$ from './activity.module.css';

interface Entry {
  id: string;
  actorId?: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  details: Record<string, string | number | boolean>;
  at: string;
}

const KEYS = ['q', 'action', 'targetType', 'actorId', 'from', 'to'] as const;

export const ACTIONS = [
  'TEAM_INVITED',
  'TEAM_INVITE_WITHDRAWN',
  'TEAM_ADDED',
  'TEAM_ROLE_CHANGED',
  'TEAM_REMOVED',
  'TEAM_RESTORED',
  'SETTINGS_CHANGED',
  'CATEGORY_REQUESTED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_STATUS',
  'PRODUCT_DELETED',
  'SERVICE_CREATED',
  'SERVICE_UPDATED',
  'SERVICE_DELETED',
  'SERVICES_ONLINE',
  'ORDER_REJECTED',
  'ORDER_RETURNED',
  'SALE_REFUNDED',
  'CUSTOMER_ADDED',
  'CUSTOMER_EDITED',
  'PROMOTION_CREATED',
  'PROMOTION_UPDATED',
  'PROMOTION_ENDED',
  'DATA_IMPORTED',
  'DATA_EXPORTED',
] as const;
const AREAS = [
  'MEMBER',
  'SHOP',
  'PRODUCT',
  'SERVICE',
  'ORDER',
  'SALE',
  'CUSTOMER',
  'PROMOTION',
  'DATA',
] as const;

/** Red for things taken away, green for things added. */
const tone = (action: string) =>
  /DELETED|REMOVED|REJECTED|RETURNED|REFUNDED|WITHDRAWN|ENDED/.test(action)
    ? a$.bad
    : /CREATED|ADDED|INVITED|RESTORED|IMPORTED/.test(action)
      ? a$.good
      : a$.neutral;

/**
 * The shop activity log (docs/api/phase18-shop-activity.md): who did what in the shop, newest
 * first, filtered by action, area, person and dates, with saved views and a CSV. Owners and
 * managers only; staff see why not.
 */
export function ActivityLog({ businessId }: { businessId: string }) {
  const t = useTranslations('activity');
  const role = useMyRole(businessId);
  const allowed = role === 'OWNER' || role === 'MANAGER';
  const list = useListQuery(KEYS, { size: 50 });
  const { values: v } = list;
  const query = list.apiQuery();
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['activity', businessId, query],
    queryFn: () => api.get<{ items: Entry[]; total: number }>(`/activity?${query}`, { businessId }),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const { data: team } = useTeam(businessId);
  const rangeLabel = useRangeLabel(t('when'));
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const detail = (e: Entry) =>
    Object.entries(e.details)
      .map(
        ([k, x]) =>
          `${t.has(`detail.${k}` as 'detail.rows') ? t(`detail.${k}` as 'detail.rows') : k}: ${x}`,
      )
      .join(' · ');

  if (role && !allowed) {
    return (
      <>
        <h1 className={a$.title}>{t('title')}</h1>
        <EmptyView title={t('ownerOnly')} body={t('ownerOnlyBody')} />
      </>
    );
  }

  const columns: Column<Entry>[] = [
    {
      key: 'at',
      header: t('when'),
      cell: (e) => <span className={a$.num}>{fmt(e.at)}</span>,
    },
    { key: 'who', header: t('who'), cell: (e) => e.actorName },
    {
      key: 'action',
      header: t('action'),
      cell: (e) => (
        <span className={`${a$.tag} ${tone(e.action)}`}>
          {t.has(`actions.${e.action}` as 'actions.DATA_EXPORTED')
            ? t(`actions.${e.action}` as 'actions.DATA_EXPORTED')
            : e.action}
        </span>
      ),
    },
    {
      key: 'target',
      header: t('target'),
      cell: (e) => (
        <span className={a$.target}>
          {e.targetLabel ?? '—'}
          <span className={a$.sub}>{t(`areas.${e.targetType}` as 'areas.DATA')}</span>
        </span>
      ),
    },
    {
      key: 'details',
      header: t('details'),
      hideNarrow: true,
      cell: (e) => <span className={a$.sub}>{detail(e)}</span>,
    },
  ];

  return (
    <>
      <div className={a$.head}>
        <div>
          <h1 className={a$.title}>{t('title')}</h1>
          <p>{data ? t('sub', { n: data.total }) : t('subLoading')}</p>
        </div>
        <ExportButton
          path={`/activity/export?${list.apiQuery()}`}
          businessId={businessId}
          className={a$.ghost}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <FilterBar
          views="shop.activity"
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chipsFor(
            list,
            {
              action: (x) => `${t('action')}: ${t(`actions.${x}` as 'actions.DATA_EXPORTED')}`,
              targetType: (x) => `${t('area')}: ${t(`areas.${x}` as 'areas.DATA')}`,
              actorId: (x) => `${t('who')}: ${team?.find((m) => m.userId === x)?.name ?? '—'}`,
            },
            rangeLabel,
          )}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('who')}
            value={v.actorId}
            onChange={(actorId) => list.set({ actorId })}
            options={(team ?? [])
              .filter((m) => m.userId)
              .map((m) => ({ value: m.userId!, label: m.name }))}
          />
          <SelectFilter
            label={t('area')}
            value={v.targetType}
            onChange={(targetType) => list.set({ targetType, action: '' })}
            options={AREAS.map((x) => ({ value: x, label: t(`areas.${x}`) }))}
          />
          <SelectFilter
            label={t('action')}
            value={v.action}
            onChange={(action) => list.set({ action })}
            options={ACTIONS.map((x) => ({ value: x, label: t(`actions.${x}`) }))}
          />
          <DateRangeFilter
            label={t('when')}
            from={v.from}
            to={v.to}
            onChange={(from, to) => list.set({ from, to })}
          />
        </FilterBar>
      </div>
      <section className={a$.panel}>
        <DataTable
          label={t('title')}
          columns={columns}
          rows={data?.items}
          rowKey={(e) => e.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={
            list.active.length
              ? { title: t('noMatch'), body: t('noMatchBody') }
              : { title: t('empty'), body: t('emptyBody') }
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
