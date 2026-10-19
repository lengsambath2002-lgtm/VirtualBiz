'use client';

import { useTranslations } from 'next-intl';

import { useShops } from '@/features/admin-shared/api';
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
  VerificationPill,
} from '@/features/admin-shared/components/ui';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s } from '@/features/seller-shared';
import { useRouter } from '@/lib/i18n/navigation';

const KEYS = ['q', 'type', 'verification', 'status', 'sort'] as const;

/** `/admin/shops`: every business, with the ID-check queue one filter away. */
export function ShopsPage() {
  const t = useTranslations('admin.shops');
  const ta = useTranslations('admin');
  const f = useAdminFmt();
  const router = useRouter();
  const { values: v, page, set } = useListParams(KEYS);
  const { data, isPending, error, refetch } = useShops({ ...v, page, size: 20 });
  const open = (id: string) => router.push(`/admin/shops/${id}`);
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
          label={t('verificationLabel')}
          value={v.verification}
          onChange={(verification) =>
            set({ verification, sort: verification === 'PENDING' ? 'pending' : v.sort })
          }
          options={[
            { value: '', label: ta('common.all') },
            { value: 'PENDING', label: ta('verification.PENDING') },
            { value: 'VERIFIED', label: ta('verification.VERIFIED') },
            { value: 'REJECTED', label: ta('verification.REJECTED') },
          ]}
        />
        <Seg
          label={t('statusLabel')}
          value={v.status}
          onChange={(status) => set({ status })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'active', label: t('status.active') },
            { value: 'offline', label: t('status.offline') },
            { value: 'suspended', label: t('status.suspended') },
          ]}
        />
        <Seg
          label={t('typeLabel')}
          value={v.type}
          onChange={(type) => set({ type })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'PRODUCT', label: ta('type.PRODUCT') },
            { value: 'SERVICE', label: ta('type.SERVICE') },
          ]}
        />
        <select
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          aria-label={t('sortLabel')}
          value={v.sort}
          onChange={(e) => set({ sort: e.target.value })}
        >
          <option value="">{t('sort.newest')}</option>
          <option value="pending">{t('sort.pending')}</option>
          <option value="gmv">{t('sort.gmv')}</option>
          <option value="rating">{t('sort.rating')}</option>
          <option value="name">{t('sort.name')}</option>
        </select>
      </div>
      <section className={s.panel}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : !data?.items.length ? (
          <Empty title={t('empty')} sub={t('emptySub')} />
        ) : (
          <div className={s.tblWrap}>
            <table>
              <thead>
                <tr>
                  <th>{t('col.shop')}</th>
                  <th>{t('col.owner')}</th>
                  <th>{t('col.check')}</th>
                  <th>{t('col.status')}</th>
                  <th className={s.r}>{t('col.gmv30')}</th>
                  <th className={s.r}>{t('col.rating')}</th>
                  <th>{t('col.joined')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr
                    key={b.id}
                    className={s.clk}
                    tabIndex={0}
                    onClick={() => open(b.id)}
                    onKeyDown={(e) => e.key === 'Enter' && open(b.id)}
                  >
                    <td>
                      <div className={s.cw}>
                        <Avatar name={b.name} url={b.logoUrl} size={34} square />
                        <div style={{ minWidth: 0 }}>
                          <div className={s.who}>{b.name}</div>
                          <span className={cx(s.tiny, s.muted)}>
                            {ta(`type.${b.type}`)} · {b.district}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{b.ownerName}</div>
                      <span className={cx(s.tiny, s.muted)}>{b.ownerContact}</span>
                    </td>
                    <td>
                      <VerificationPill v={b.verification} />
                      {b.verification === 'PENDING' && !b.hasIdPhoto && (
                        <span className={cx(s.tiny, s.muted, s.block)}>{t('noPhoto')}</span>
                      )}
                    </td>
                    <td>
                      {b.suspendedAt ? (
                        <Pill tone="bad">{t('status.suspended')}</Pill>
                      ) : b.online ? (
                        <Pill tone="ok">{t('status.active')}</Pill>
                      ) : (
                        <Pill tone="neutral">{t('status.offline')}</Pill>
                      )}
                    </td>
                    <td className={cx(s.r, s.num)}>
                      {f.money0(b.gmv30)}
                      <span className={cx(s.tiny, s.muted, s.block)}>
                        {t('ordersN', { n: b.orders30 })}
                      </span>
                    </td>
                    <td className={cx(s.r, s.num)}>
                      {b.reviewCount ? `★ ${b.rating.toFixed(1)}` : '—'}
                      <span className={cx(s.tiny, s.muted, s.block)}>{b.reviewCount}</span>
                    </td>
                    <td className={s.num}>{f.date(b.createdAt)}</td>
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
