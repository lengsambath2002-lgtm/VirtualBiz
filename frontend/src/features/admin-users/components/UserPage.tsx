'use client';

import { useTranslations } from 'next-intl';
import { LoadFailed } from '@/components/feedback';

import { adminApi, useAdminAction, useUser } from '@/features/admin-shared/api';
import { AuditList } from '@/features/admin-shared/components/AuditList';
import { OrdersTable } from '@/features/admin-shared/components/OrdersTable';
import {
  Avatar,
  KV,
  Loading,
  PageHead,
  Pill,
  VerificationPill,
} from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type { PlatformRole } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s, useUi } from '@/features/seller-shared';
import { useSession } from '@/lib/auth';
import { Link } from '@/lib/i18n/navigation';
import { formatPhone } from '@/lib/utils/phone';

import { RolePill } from './RolePill';

/** `/admin/users/[id]`: an account's file and the account actions. */
export function UserPage({ id }: { id: string }) {
  const t = useTranslations('admin.user');
  const ta = useTranslations('admin');
  const f = useAdminFmt();
  const me = useSession().user;
  const { data: d, isPending, error, refetch } = useUser(id);
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  if (error && !d)
    return (
      <LoadFailed
        error={error}
        retry={() => void refetch()}
        home="/admin/users"
        homeLabel={ta('user.backList')}
        notFoundTitle={ta('user.missing')}
      />
    );
  if (isPending || !d || !me) return <Loading />;
  const u = d.user;
  const go = (fn: () => Promise<unknown>) => run.mutateAsync(fn);
  const self = me.id === u.id;
  // Staff accounts are a super-admin's to change.
  const canChange = !self && (!u.platformRole || me.platformRole === 'SUPER_ADMIN');

  const suspend = () =>
    act({
      title: t('suspendTitle', { name: u.name }),
      body: t('suspendBody'),
      ok: t('suspend'),
      danger: true,
      reason: 'required',
      done: t('suspended'),
      run: (r) => go(() => adminApi.suspendUser(id, r)),
    });
  const reinstate = () =>
    act({
      title: t('reinstateTitle', { name: u.name }),
      ok: t('reinstate'),
      reason: 'optional',
      done: t('reinstated'),
      run: (r) => go(() => adminApi.reinstateUser(id, r || undefined)),
    });
  const signOut = () =>
    act({
      title: t('signOutTitle', { name: u.name }),
      body: t('signOutBody', { n: d.activeSessions }),
      ok: t('signOut'),
      reason: 'optional',
      done: t('signedOut'),
      run: (r) => go(() => adminApi.signOutUser(id, r || undefined)),
    });
  const setRole = async () => {
    const v = await useUi.getState().confirm({
      title: t('roleTitle', { name: u.name }),
      body: t('roleBody'),
      ok: t('roleSave'),
      fields: [
        {
          type: 'select',
          key: 'role',
          label: t('roleLabel'),
          value: u.platformRole ?? '',
          options: [
            { value: '', label: t('roleNone') },
            { value: 'ADMIN', label: ta('users.role.ADMIN') },
            { value: 'SUPER_ADMIN', label: ta('users.role.SUPER_ADMIN') },
          ],
        },
      ],
    });
    if (!v) return;
    const role = (String(v.role) || null) as PlatformRole | null;
    try {
      await go(() => adminApi.setRole(id, role));
      useUi.getState().showToast(t('roleSaved'));
    } catch {
      useUi.getState().showToast(ta('errors.SUPER_ADMIN_ONLY'));
    }
  };

  return (
    <>
      <p className={cx(s.small, s.muted)} style={{ marginBottom: 8 }}>
        <Link href="/admin/users">{t('back')}</Link>
      </p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 4 }}>
        <Avatar name={u.name} url={u.avatarUrl} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageHead
            title={u.name}
            sub={t('joined', { date: f.date(u.createdAt) })}
            actions={
              canChange ? (
                <>
                  {me.platformRole === 'SUPER_ADMIN' && (
                    <button
                      type="button"
                      className={cx(s.btn, s.btnGhost)}
                      onClick={() => void setRole()}
                    >
                      {t('role')}
                    </button>
                  )}
                  <button
                    type="button"
                    className={cx(s.btn, s.btnGhost)}
                    onClick={() => void signOut()}
                  >
                    {t('signOut')}
                  </button>
                  {u.suspendedAt ? (
                    <button
                      type="button"
                      className={cx(s.btn, s.btnPrimary)}
                      onClick={() => void reinstate()}
                    >
                      {t('reinstate')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cx(s.btn, s.btnDanger)}
                      onClick={() => void suspend()}
                    >
                      {t('suspend')}
                    </button>
                  )}
                </>
              ) : self ? (
                <span className={cx(s.small, s.muted)}>{t('you')}</span>
              ) : null
            }
          />
        </div>
      </div>
      {u.suspendedAt && (
        <div className={s.warnbox} role="status" style={{ marginBottom: 16 }}>
          <strong>{t('suspendedSince', { date: f.dateTime(u.suspendedAt) })}</strong>
          <span>{d.suspendedReason}</span>
        </div>
      )}
      <div className={s.kpis}>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('orders')}</span>
          <span className={s.kpiV}>{u.orders}</span>
          <span className={s.kpiS}>{t('spent', { amount: f.money0(u.spent) })}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('bookings')}</span>
          <span className={s.kpiV}>{d.bookings}</span>
          <span className={s.kpiS}>{t('reviewsN', { n: d.reviews })}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('lastSeen')}</span>
          <span className={s.kpiV} style={{ fontSize: 18 }}>
            {f.dateTime(d.lastSeenAt)}
          </span>
          <span className={s.kpiS}>{t('sessions', { n: d.activeSessions })}</span>
        </div>
      </div>
      <div className={s.cols} style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('recentOrders')}</h2>
              <Link className={s.small} href={`/admin/orders?customerId=${id}`}>
                {t('allOrders')}
              </Link>
            </div>
            <OrdersTable rows={d.recentOrders} hideCustomer />
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('history')}</h2>
            </div>
            <AuditList rows={d.history} />
          </section>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('account')}</h2>
              {u.platformRole && <RolePill role={u.platformRole} />}
            </div>
            <div className={s.panelB}>
              <KV
                rows={[
                  [t('email'), u.email ?? '—'],
                  [t('phone'), u.phone ? formatPhone(u.phone) : '—'],
                  [
                    t('signIn'),
                    d.signInMethods.map((m) => ta(`signIn.${m}` as 'signIn.PASSWORD')).join(', '),
                  ],
                  [
                    t('status'),
                    u.suspendedAt ? (
                      <Pill tone="bad">{ta('users.status.suspended')}</Pill>
                    ) : (
                      <Pill tone="ok">{ta('users.status.active')}</Pill>
                    ),
                  ],
                  [
                    t('id'),
                    <span key="id" className={cx(s.tiny, s.num)}>
                      {u.id}
                    </span>,
                  ],
                ]}
              />
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('businesses', { n: d.businesses.length })}</h2>
            </div>
            <div className={s.panelB} style={{ display: 'grid', gap: 10 }}>
              {d.businesses.length === 0 && <span className={s.muted}>{t('noBusinesses')}</span>}
              {d.businesses.map((b) => (
                <Link
                  key={b.businessId}
                  href={`/admin/shops/${b.businessId}`}
                  className={cx(s.cw, s.noUnderline)}
                  style={{ color: 'inherit' }}
                >
                  <Avatar name={b.name} size={30} square />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block' }}>{b.name}</span>
                    <span className={cx(s.tiny, s.muted)}>
                      {ta(`type.${b.type}`)} · {ta(`role.${b.role}` as 'role.OWNER')}
                    </span>
                  </span>
                  {b.suspendedAt ? (
                    <Pill tone="bad">{ta('shops.status.suspended')}</Pill>
                  ) : (
                    <VerificationPill v={b.verification} />
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
