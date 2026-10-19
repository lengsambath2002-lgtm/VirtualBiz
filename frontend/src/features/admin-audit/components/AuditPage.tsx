'use client';

import { useTranslations } from 'next-intl';

import { useAudit } from '@/features/admin-shared/api';
import { AuditList } from '@/features/admin-shared/components/AuditList';
import {
  Loading,
  PageHead,
  Pager,
  PanelError,
  SearchBox,
  Seg,
} from '@/features/admin-shared/components/ui';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import { s } from '@/features/seller-shared';

const KEYS = ['q', 'targetType'] as const;

/** `/admin/audit`: every staff action, newest first (append-only). */
export function AuditPage() {
  const t = useTranslations('admin.audit');
  const ta = useTranslations('admin');
  const { values: v, page, set } = useListParams(KEYS);
  const { data, isPending, error, refetch } = useAudit({ ...v, page, size: 30 });
  return (
    <>
      <PageHead title={t('title')} sub={t('sub')} />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <SearchBox
          value={v.q}
          onChange={(q) => set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
        />
        <Seg
          label={t('targetLabel')}
          value={v.targetType}
          onChange={(targetType) => set({ targetType })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'BUSINESS', label: t('target.BUSINESS') },
            { value: 'USER', label: t('target.USER') },
            { value: 'ORDER', label: t('target.ORDER') },
            { value: 'REVIEW', label: t('target.REVIEW') },
            { value: 'PROMOTION', label: t('target.PROMOTION') },
            { value: 'PAYOUT', label: t('target.PAYOUT') },
          ]}
        />
      </div>
      <section className={s.panel} style={{ paddingTop: 12 }}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : (
          <AuditList rows={data?.items ?? []} showTarget />
        )}
        {data && (
          <Pager page={page} size={data.size} total={data.total} onPage={(p) => set({ page: p })} />
        )}
      </section>
    </>
  );
}
