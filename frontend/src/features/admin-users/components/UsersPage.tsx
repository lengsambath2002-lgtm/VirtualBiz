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
import { adminApi, type BulkResult, useAdminAction, useUsers } from '@/features/admin-shared/api';
import { Avatar, PageHead, Pill } from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type { UserRow } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s } from '@/features/seller-shared';
import { useRouter } from '@/lib/i18n/navigation';
import { formatPhone } from '@/lib/utils/phone';

import { RolePill } from './RolePill';

const KEYS = ['q', 'kind', 'status', 'from', 'to'] as const;

/** `/admin/users`: every account by kind and status, with bulk suspend / sign-out and export. */
export function UsersPage() {
  const t = useTranslations('admin.users');
  const ta = useTranslations('admin');
  const tl = useTranslations('admin.lists');
  const f = useAdminFmt();
  const router = useRouter();
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const list = useListQuery(KEYS, { sort: '-created' });
  const { values: v } = list;
  const { data, isPending, isFetching, error, refetch } = useUsers(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const [sel, setSel] = useState<Set<string>>(new Set());
  const rangeLabel = useRangeLabel(t('col.joined'));

  const bulk = (action: 'suspend' | 'reinstate' | 'signOut') =>
    void act<BulkResult>({
      title: tl(`bulk.users.${action}Title`, { n: sel.size }),
      body: tl(`bulk.users.${action}Body`),
      ok: tl(`bulk.users.${action}`),
      ...(action === 'suspend'
        ? { danger: true, reason: 'required' as const }
        : { reason: 'optional' as const }),
      done: (r) =>
        r.failed.length
          ? tl('bulk.partly', { done: r.done, failed: r.failed.length })
          : tl('bulk.done', { n: r.done }),
      run: (reason) =>
        run.mutateAsync(() =>
          adminApi.bulk('users', [...sel], action, reason || undefined),
        ) as Promise<BulkResult>,
    }).then((r) => r && setSel(new Set(r.failed.map((x) => x.id))));

  const columns: Column<UserRow>[] = [
    {
      key: 'user',
      header: t('col.user'),
      sort: 'name',
      cell: (u) => (
        <div className={s.cw}>
          <Avatar name={u.name} url={u.avatarUrl} size={34} />
          <div style={{ minWidth: 0 }}>
            <div className={s.who}>{u.name}</div>
            {u.platformRole && <RolePill role={u.platformRole} />}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: t('col.contact'),
      hideNarrow: true,
      cell: (u) => (
        <>
          <div style={{ overflowWrap: 'anywhere' }}>{u.email ?? '—'}</div>
          <span className={cx(s.tiny, s.muted, s.num)}>{u.phone ? formatPhone(u.phone) : ''}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      cell: (u) =>
        u.suspendedAt ? (
          <Pill tone="bad">{t('status.suspended')}</Pill>
        ) : (
          <Pill tone="ok">{t('status.active')}</Pill>
        ),
    },
    {
      key: 'orders',
      header: t('col.orders'),
      sort: 'orders',
      sortFirst: 'desc',
      align: 'right',
      cell: (u) => <span className={s.num}>{u.orders}</span>,
    },
    {
      key: 'spent',
      header: t('col.spent'),
      sort: 'spent',
      sortFirst: 'desc',
      align: 'right',
      cell: (u) => <span className={s.num}>{f.money0(u.spent)}</span>,
    },
    {
      key: 'shops',
      header: t('col.shops'),
      align: 'right',
      hideNarrow: true,
      cell: (u) => <span className={s.num}>{u.businesses || '—'}</span>,
    },
    {
      key: 'joined',
      header: t('col.joined'),
      sort: 'created',
      sortFirst: 'desc',
      cell: (u) => <span className={s.num}>{f.date(u.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHead
        title={t('title')}
        sub={data ? t('sub', { n: data.total }) : undefined}
        actions={
          <ExportButton
            path={`/admin/users/export?${list.apiQuery()}`}
            className={cx(s.btn, s.btnGhost)}
          />
        }
      />
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <SegmentFilter
          label={t('kindLabel')}
          value={v.kind}
          onChange={(kind) => list.set({ kind })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'customer', label: t('kind.customer') },
            { value: 'merchant', label: t('kind.merchant') },
            { value: 'staff', label: t('kind.staff') },
          ]}
        />
        <FilterBar
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chipsFor(
            list,
            { status: (x) => `${t('statusLabel')}: ${t(`status.${x}` as 'status.active')}` },
            rangeLabel,
          )}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('statusLabel')}
            value={v.status}
            onChange={(status) => list.set({ status })}
            options={(['active', 'suspended'] as const).map((x) => ({
              value: x,
              label: t(`status.${x}`),
            }))}
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
          rowKey={(u) => u.id}
          loading={isFetching && !isPending}
          error={error}
          retry={() => void refetch()}
          empty={{ title: t('empty'), body: tl('emptyBody') }}
          sort={list.sort}
          onSort={list.toggleSort}
          selected={sel}
          onSelect={setSel}
          onRow={(u) => router.push(`/admin/users/${u.id}`)}
          bulk={
            <>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('suspend')}
              >
                {tl('bulk.users.suspend')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('reinstate')}
              >
                {tl('bulk.users.reinstate')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => bulk('signOut')}
              >
                {tl('bulk.users.signOut')}
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
