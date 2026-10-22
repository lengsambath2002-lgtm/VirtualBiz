'use client';

import { useTranslations } from 'next-intl';

import { Pagination } from '@/components/data';
import { LoadFailed } from '@/components/feedback';
import { useState } from 'react';

import {
  adminApi,
  useAdminAction,
  useIdPhoto,
  useShop,
  useShopActivity,
} from '@/features/admin-shared/api';
import { AuditList } from '@/features/admin-shared/components/AuditList';
import { OrdersTable } from '@/features/admin-shared/components/OrdersTable';
import {
  Avatar,
  Empty,
  KV,
  Loading,
  PageHead,
  PanelError,
  Pill,
  VerificationPill,
} from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';
import { formatPhone } from '@/lib/utils/phone';

/** The ID photo, loaded only when the reviewer opens it. */
function IdPhoto({ id, has }: { id: string; has: boolean }) {
  const t = useTranslations('admin.shop');
  const f = useAdminFmt();
  const [show, setShow] = useState(false);
  const { data, isPending } = useIdPhoto(id, show && has);
  if (!has) return <p className={s.muted}>{t('noIdPhoto')}</p>;
  if (!show)
    return (
      <button
        type="button"
        className={cx(s.btn, s.btnGhost, s.btnSm)}
        onClick={() => setShow(true)}
      >
        {t('showId')}
      </button>
    );
  if (isPending || !data) return <span className={s.spin} />;
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an inline data URL, not an asset */}
      <img
        src={data.dataUrl}
        alt={t('idAlt')}
        style={{
          maxWidth: '100%',
          maxHeight: 360,
          borderRadius: 12,
          border: '1px solid var(--line)',
        }}
      />
      <figcaption className={cx(s.tiny, s.muted)}>
        {t('idUploaded', { date: f.dateTime(data.uploadedAt), kb: Math.round(data.size / 1024) })}
      </figcaption>
    </figure>
  );
}

/** `/admin/shops/[id]`: a shop's file, the ID check, suspension, its people, orders and history. */
export function ShopPage({ id }: { id: string }) {
  const t = useTranslations('admin.shop');
  const ta = useTranslations('admin');
  const f = useAdminFmt();
  const { data: d, isPending, error, refetch } = useShop(id);
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  if (error && !d)
    return (
      <LoadFailed
        error={error}
        retry={() => void refetch()}
        home="/admin/shops"
        homeLabel={ta('shop.backList')}
        notFoundTitle={ta('shop.missing')}
      />
    );
  if (isPending || !d) return <Loading />;
  const b = d.shop;
  const go = (fn: () => Promise<unknown>) => run.mutateAsync(fn);

  const verify = () =>
    act({
      title: t('verifyTitle', { name: b.name }),
      body: t('verifyBody'),
      ok: t('verify'),
      reason: 'optional',
      done: t('verified'),
      run: (r) => go(() => adminApi.verify(id, r || undefined)),
    });
  const reject = () =>
    act({
      title: t('rejectTitle', { name: b.name }),
      body: t('rejectBody'),
      ok: t('reject'),
      danger: true,
      reason: 'required',
      reasonLabel: t('rejectReason'),
      done: t('rejected'),
      run: (r) => go(() => adminApi.reject(id, r)),
    });
  const suspend = () =>
    act({
      title: t('suspendTitle', { name: b.name }),
      body: t('suspendBody'),
      ok: t('suspend'),
      danger: true,
      reason: 'required',
      reasonLabel: t('suspendReason'),
      done: t('suspended'),
      run: (r) => go(() => adminApi.suspendShop(id, r)),
    });
  const reinstate = () =>
    act({
      title: t('reinstateTitle', { name: b.name }),
      body: t('reinstateBody'),
      ok: t('reinstate'),
      reason: 'optional',
      done: t('reinstated'),
      run: (r) => go(() => adminApi.reinstateShop(id, r || undefined)),
    });

  return (
    <>
      <p className={cx(s.small, s.muted)} style={{ marginBottom: 8 }}>
        <Link href="/admin/shops">{t('back')}</Link>
      </p>
      <PageHead
        title={b.name}
        sub={`${ta(`type.${b.type}`)} · ${b.district} · ${t('joined', { date: f.date(b.createdAt) })}`}
        actions={
          <>
            {b.verification !== 'VERIFIED' && (
              <button
                type="button"
                className={cx(s.btn, s.btnPrimary)}
                onClick={() => void verify()}
              >
                {t('verify')}
              </button>
            )}
            {b.verification !== 'REJECTED' && (
              <button type="button" className={cx(s.btn, s.btnGhost)} onClick={() => void reject()}>
                {b.verification === 'VERIFIED' ? t('revoke') : t('reject')}
              </button>
            )}
            {b.suspendedAt ? (
              <button
                type="button"
                className={cx(s.btn, s.btnGhost)}
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
            <Link className={cx(s.btn, s.btnGhost)} href={`/shop/${b.slug}`} target="_blank">
              {t('viewShop')}
            </Link>
          </>
        }
      />
      {b.suspendedAt && (
        <div className={s.warnbox} role="status" style={{ marginBottom: 16 }}>
          <strong>{t('suspendedSince', { date: f.dateTime(b.suspendedAt) })}</strong>
          <span>{d.suspendedReason}</span>
        </div>
      )}
      <div className={s.kpis}>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('gmvAll')}</span>
          <span className={s.kpiV}>{f.money0(d.stats.gmv)}</span>
          <span className={s.kpiS}>{t('ordersN', { n: d.stats.orders })}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('gmv30')}</span>
          <span className={s.kpiV}>{f.money0(b.gmv30)}</span>
          <span className={s.kpiS}>{t('ordersN', { n: b.orders30 })}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('payable')}</span>
          <span className={s.kpiV}>{f.money(d.stats.payable)}</span>
          <span className={s.kpiS}>{t('paidOut', { amount: f.money0(d.stats.paidOut) })}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('catalogue')}</span>
          <span className={s.kpiV}>
            {b.type === 'SERVICE' ? d.stats.services : d.stats.products}
          </span>
          <span className={s.kpiS}>
            {b.reviewCount
              ? t('ratingN', { r: b.rating.toFixed(1), n: b.reviewCount })
              : t('noReviews')}
          </span>
        </div>
      </div>
      <div className={s.cols} style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('idCheck')}</h2>
              <VerificationPill v={b.verification} />
            </div>
            <div className={s.panelB} style={{ display: 'grid', gap: 12 }}>
              {b.verification === 'REJECTED' && d.verificationNote && (
                <div className={s.warnbox}>
                  {t('rejectedBecause', { reason: d.verificationNote })}
                </div>
              )}
              {d.verifiedAt && (
                <span className={cx(s.small, s.muted)}>
                  {t('decidedBy', {
                    name: d.verifiedByName ?? '—',
                    date: f.dateTime(d.verifiedAt),
                  })}
                </span>
              )}
              <IdPhoto id={id} has={b.hasIdPhoto} />
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('recentOrders')}</h2>
              <Link className={cx(s.small)} href={`/admin/orders?businessId=${id}`}>
                {t('allOrders')}
              </Link>
            </div>
            <OrdersTable rows={d.recentOrders} hideShop />
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('history')}</h2>
            </div>
            <AuditList rows={d.history} />
          </section>
          <ShopActivity id={id} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('details')}</h2>
            </div>
            <div className={s.panelB}>
              <KV
                rows={[
                  [
                    t('owner'),
                    <Link key="o" href={`/admin/users/${b.ownerId}`}>
                      {b.ownerName}
                    </Link>,
                  ],
                  [t('phone'), formatPhone(d.phone)],
                  [t('email'), d.email ?? '—'],
                  [t('address'), `${d.street}, ${b.district}`],
                  [
                    t('bakong'),
                    d.bakongId ? (
                      <span className={s.num}>{d.bakongId}</span>
                    ) : (
                      <Pill tone="warn">{t('noBakong')}</Pill>
                    ),
                  ],
                  [t('category'), b.categoryId],
                  [t('slug'), b.slug],
                  [t('about'), d.about ?? '—'],
                ]}
              />
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('team', { n: d.members.length })}</h2>
            </div>
            <div className={s.panelB} style={{ display: 'grid', gap: 10 }}>
              {d.members.map((m) => (
                <div key={(m.userId ?? '') + m.name} className={s.cw}>
                  <Avatar name={m.name} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div>
                      {m.userId ? <Link href={`/admin/users/${m.userId}`}>{m.name}</Link> : m.name}{' '}
                      {!m.active && <Pill tone="neutral">{t('inactive')}</Pill>}
                    </div>
                    <span className={cx(s.tiny, s.muted)}>
                      {ta(`role.${m.role}` as 'role.OWNER')}
                      {m.title && m.title !== ta(`role.${m.role}` as 'role.OWNER')
                        ? ` · ${m.title}`
                        : ''}
                      {m.email ? ` · ${m.email}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** What the shop's own team did (its activity log), ten at a time. */
function ShopActivity({ id }: { id: string }) {
  const t = useTranslations('admin.shop');
  const ta = useTranslations('activity');
  const f = useAdminFmt();
  const [page, setPage] = useState(0);
  const { data, error, refetch } = useShopActivity(id, page);
  return (
    <section className={s.panel}>
      <div className={s.panelH}>
        <h2>{t('teamActivity')}</h2>
      </div>
      {error && !data ? (
        <PanelError error={error} retry={() => void refetch()} />
      ) : !data ? (
        <Loading />
      ) : !data.items.length ? (
        <Empty title={ta('empty')} sub={ta('emptyBody')} />
      ) : (
        <div className={s.tblWrap}>
          <table>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td className={cx(s.small, s.num)} style={{ whiteSpace: 'nowrap' }}>
                    {f.dateTime(e.at)}
                  </td>
                  <td className={s.small}>{e.actorName}</td>
                  <td className={s.small}>
                    {ta.has(`actions.${e.action}` as 'actions.DATA_EXPORTED')
                      ? ta(`actions.${e.action}` as 'actions.DATA_EXPORTED')
                      : e.action}
                    {e.targetLabel && (
                      <span className={cx(s.tiny, s.muted, s.block)}>{e.targetLabel}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} size={10} total={data.total} onPage={setPage} />}
    </section>
  );
}
