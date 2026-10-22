'use client';

import { useTranslations } from 'next-intl';

import {
  chipsFor,
  DateRangeFilter,
  ExportButton,
  FilterBar,
  Pagination,
  SelectFilter,
  useListQuery,
  useRangeLabel,
} from '@/components/data';
import { ErrorView } from '@/components/feedback';
import { useAudit } from '@/features/admin-shared/api';
import { AuditList } from '@/features/admin-shared/components/AuditList';
import { Loading, PageHead } from '@/features/admin-shared/components/ui';
import { cx, s } from '@/features/seller-shared';

const KEYS = ['q', 'targetType', 'targetId', 'action', 'from', 'to'] as const;

const TARGETS = [
  'BUSINESS',
  'USER',
  'ORDER',
  'REVIEW',
  'PROMOTION',
  'PAYOUT',
  'SETTINGS',
  'CATEGORY',
  'STAFF_INVITE',
  'EXPORT',
] as const;

const ACTIONS = [
  'BUSINESS_VERIFIED',
  'BUSINESS_REJECTED',
  'BUSINESS_SUSPENDED',
  'BUSINESS_REINSTATED',
  'USER_SUSPENDED',
  'USER_REINSTATED',
  'USER_ROLE_CHANGED',
  'USER_SIGNED_OUT',
  'ORDER_CANCELLED',
  'ORDER_REFUNDED',
  'REVIEW_HIDDEN',
  'REVIEW_RESTORED',
  'PROMOTION_CREATED',
  'PROMOTION_UPDATED',
  'PROMOTION_ENDED',
  'PAYOUT_RECORDED',
  'SETTINGS_UPDATED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORIES_REORDERED',
  'CATEGORY_REQUEST_APPROVED',
  'CATEGORY_REQUEST_REJECTED',
  'STAFF_INVITED',
  'STAFF_INVITE_REVOKED',
  'STAFF_JOINED',
  'STAFF_MFA_RESET',
  'MFA_ENABLED',
  'MFA_RECOVERY_USED',
  'MFA_RECOVERY_REGENERATED',
  'DATA_EXPORTED',
] as const;

/** `/admin/audit`: every staff action, newest first (append-only), searchable and exportable. */
export function AuditPage() {
  const t = useTranslations('admin.audit');
  const tl = useTranslations('admin.lists');
  const list = useListQuery(KEYS, { size: 50 });
  const { values: v } = list;
  const { data, isPending, error, refetch } = useAudit(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const rangeLabel = useRangeLabel(tl('when'));
  return (
    <>
      <PageHead
        title={t('title')}
        sub={data ? `${t('sub')} ${tl('entries', { n: data.total })}` : t('sub')}
        actions={
          <ExportButton
            path={`/admin/audit/export?${list.apiQuery()}`}
            className={cx(s.btn, s.btnGhost)}
          />
        }
      />
      <div style={{ marginBottom: 12 }}>
        <FilterBar
          views="admin.audit"
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
          active={chipsFor(
            list,
            {
              targetType: (x) => `${t('targetLabel')}: ${t(`target.${x}` as 'target.USER')}`,
              action: (x) => `${tl('action')}: ${t(`actions.${x}` as 'actions.MFA_ENABLED')}`,
              targetId: (x) => `${tl('target')}: ${x}`,
            },
            rangeLabel,
          )}
          onClearAll={list.reset}
        >
          <SelectFilter
            label={t('targetLabel')}
            value={v.targetType}
            onChange={(targetType) => list.set({ targetType })}
            options={TARGETS.map((x) => ({ value: x, label: t(`target.${x}`) }))}
          />
          <SelectFilter
            label={tl('action')}
            value={v.action}
            onChange={(action) => list.set({ action })}
            options={ACTIONS.map((x) => ({ value: x, label: t(`actions.${x}`) }))}
          />
          <DateRangeFilter
            label={tl('when')}
            from={v.from}
            to={v.to}
            onChange={(from, to) => list.set({ from, to })}
          />
        </FilterBar>
      </div>
      <section className={s.panel} style={{ paddingTop: 12 }}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <ErrorView error={error} retry={() => void refetch()} size="panel" />
        ) : (
          <AuditList rows={data?.items ?? []} showTarget />
        )}
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
