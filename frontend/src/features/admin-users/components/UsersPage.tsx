'use client';

import { useTranslations } from 'next-intl';

import { useUsers } from '@/features/admin-shared/api';
import {
  Avatar,
  Empty,
  Loading,
  PanelError,
  PageHead,
  Pager,
  Pill,
  SearchBox,
  Seg,
} from '@/features/admin-shared/components/ui';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s } from '@/features/seller-shared';
import { useRouter } from '@/lib/i18n/navigation';
import { formatPhone } from '@/lib/utils/phone';

import { RolePill } from './RolePill';

const KEYS = ['q', 'kind', 'status'] as const;

/** `/admin/users`: every account, filterable by kind (customer / merchant / staff) and status. */
export function UsersPage() {
  const t = useTranslations('admin.users');
  const ta = useTranslations('admin');
  const f = useAdminFmt();
  const router = useRouter();
  const { values: v, page, set } = useListParams(KEYS);
  const { data, isPending, error, refetch } = useUsers({ ...v, page, size: 20 });
  const open = (id: string) => router.push(`/admin/users/${id}`);
  return (
    <>
      <PageHead title={t('title')} sub={data ? t('sub', { n: data.total }) : undefined} />
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
          label={t('kindLabel')}
          value={v.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'customer', label: t('kind.customer') },
            { value: 'merchant', label: t('kind.merchant') },
            { value: 'staff', label: t('kind.staff') },
          ]}
        />
        <Seg
          label={t('statusLabel')}
          value={v.status}
          onChange={(status) => set({ status })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'active', label: t('status.active') },
            { value: 'suspended', label: t('status.suspended') },
          ]}
        />
      </div>
      <section className={s.panel}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : !data?.items.length ? (
          <Empty title={t('empty')} />
        ) : (
          <div className={s.tblWrap}>
            <table>
              <thead>
                <tr>
                  <th>{t('col.user')}</th>
                  <th>{t('col.contact')}</th>
                  <th>{t('col.status')}</th>
                  <th className={s.r}>{t('col.orders')}</th>
                  <th className={s.r}>{t('col.spent')}</th>
                  <th className={s.r}>{t('col.shops')}</th>
                  <th>{t('col.joined')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr
                    key={u.id}
                    className={s.clk}
                    tabIndex={0}
                    onClick={() => open(u.id)}
                    onKeyDown={(e) => e.key === 'Enter' && open(u.id)}
                  >
                    <td>
                      <div className={s.cw}>
                        <Avatar name={u.name} url={u.avatarUrl} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div className={s.who}>{u.name}</div>
                          {u.platformRole && <RolePill role={u.platformRole} />}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ overflowWrap: 'anywhere' }}>{u.email ?? '—'}</div>
                      <span className={cx(s.tiny, s.muted, s.num)}>
                        {u.phone ? formatPhone(u.phone) : ''}
                      </span>
                    </td>
                    <td>
                      {u.suspendedAt ? (
                        <Pill tone="bad">{t('status.suspended')}</Pill>
                      ) : (
                        <Pill tone="ok">{t('status.active')}</Pill>
                      )}
                    </td>
                    <td className={cx(s.r, s.num)}>{u.orders}</td>
                    <td className={cx(s.r, s.num)}>{f.money0(u.spent)}</td>
                    <td className={cx(s.r, s.num)}>{u.businesses || '—'}</td>
                    <td className={s.num}>{f.date(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pager page={page} size={data.size} total={data.total} onPage={(p) => set({ page: p })} />
        )}
      </section>
    </>
  );
}
