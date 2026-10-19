'use client';

import { useTranslations } from 'next-intl';

import { useOrders } from '@/features/admin-shared/api';
import { OrdersTable } from '@/features/admin-shared/components/OrdersTable';
import {
  Loading,
  PageHead,
  Pager,
  PanelError,
  SearchBox,
  Seg,
} from '@/features/admin-shared/components/ui';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import { cx, s } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

const KEYS = ['q', 'status', 'businessId', 'customerId'] as const;

/** `/admin/orders`: every order on the platform. */
export function OrdersPage() {
  const t = useTranslations('admin.orders');
  const ta = useTranslations('admin');
  const { values: v, page, set } = useListParams(KEYS);
  const { data, isPending, error, refetch } = useOrders({ ...v, page, size: 25 });
  const scoped = v.businessId || v.customerId;
  return (
    <>
      <PageHead title={t('title')} sub={data ? t('sub', { n: data.total }) : undefined} />
      {scoped && (
        <p className={cx(s.small, s.muted)} style={{ marginBottom: 10 }}>
          {v.businessId ? t('scopedShop') : t('scopedCustomer')}{' '}
          <Link href="/admin/orders">{t('clearScope')}</Link>
        </p>
      )}
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
          label={t('statusLabel')}
          value={v.status}
          onChange={(status) => set({ status })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'open', label: t('filter.open') },
            { value: 'NEW', label: ta('orderStatus.NEW') },
            { value: 'DELIVERED', label: ta('orderStatus.DELIVERED') },
            { value: 'CANCELLED', label: ta('orderStatus.CANCELLED') },
            { value: 'RETURNED', label: ta('orderStatus.RETURNED') },
            { value: 'unpaid', label: t('filter.unpaid') },
          ]}
        />
      </div>
      <section className={s.panel}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : (
          <OrdersTable rows={data?.items ?? []} />
        )}
        {data && (
          <Pager page={page} size={data.size} total={data.total} onPage={(p) => set({ page: p })} />
        )}
      </section>
    </>
  );
}
