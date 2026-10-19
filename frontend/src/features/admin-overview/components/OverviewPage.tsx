'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ErrorView } from '@/components/feedback';

import { useOverview } from '@/features/admin-shared/api';
import { Avatar, Loading, PageHead } from '@/features/admin-shared/components/ui';
import type { Overview } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, Ic, s, type IcName } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

/** Daily GMV for the last 30 days (one series: the title names it, a tooltip per bar). */
function GmvChart({ days }: { days: Overview['days'] }) {
  const t = useTranslations('admin.overview');
  const f = useAdminFmt();
  const W = 640;
  const H = 200;
  const P = { l: 48, r: 8, t: 12, b: 26 };
  const max = Math.max(50, ...days.map((d) => Number(d.gmv)));
  const step = max > 5000 ? 2000 : max > 1000 ? 500 : 100;
  const nice = Math.ceil(max / step) * step;
  const bw = (W - P.l - P.r) / Math.max(1, days.length);
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  const last = days.length - 1;
  return (
    <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chartLabel')}>
      {[0, 0.5, 1].map((fr) => (
        <g key={fr}>
          <line x1={P.l} x2={W - P.r} y1={y(nice * fr)} y2={y(nice * fr)} />
          <text x={P.l - 6} y={y(nice * fr) + 4} textAnchor="end">
            {f.money0(nice * fr)}
          </text>
        </g>
      ))}
      {days.map((d, i) => (
        <g key={d.date}>
          <rect
            className={i === last ? `${s.bar} ${s.barToday}` : s.bar}
            x={P.l + i * bw + bw * 0.18}
            y={y(Number(d.gmv))}
            width={bw * 0.64}
            height={Math.max(0, H - P.b - y(Number(d.gmv)))}
            rx={3}
          >
            <title>{t('barTip', { day: f.day(d.date), gmv: f.money(d.gmv), n: d.orders })}</title>
          </rect>
          {(last - i) % 5 === 0 && (
            <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">
              {i === last ? t('today') : f.day(d.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Kpi({
  label,
  value,
  cur,
  prev,
  sub,
}: {
  label: string;
  value: string;
  cur?: number;
  prev?: number;
  sub?: ReactNode;
}) {
  const t = useTranslations('admin.overview');
  const f = useAdminFmt();
  const d = cur === undefined || prev === undefined ? null : f.delta(cur, prev);
  return (
    <div className={s.kpi}>
      <span className={s.kpiL}>{label}</span>
      <span className={s.kpiV}>{value}</span>
      <span className={s.kpiS}>
        {d !== null ? (
          <>
            <span className={d >= 0 ? s.up : s.down}>
              {d >= 0 ? '▲' : '▼'} {Math.abs(d)}%
            </span>{' '}
            {t('vsPrev')}
          </>
        ) : (
          sub
        )}
      </span>
    </div>
  );
}

function Queue({
  icon,
  n,
  label,
  href,
  urgent,
}: {
  icon: IcName;
  n: ReactNode;
  label: string;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Link
      className={cx(s.panel, s.noUnderline)}
      href={href}
      style={{ padding: 16, display: 'grid', gap: 6, color: 'inherit' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic name={icon} size={18} />
        <strong className={cx(s.num, urgent && s.dangerText)} style={{ fontSize: 22 }}>
          {n}
        </strong>
      </span>
      <span className={cx(s.small, s.muted)}>{label}</span>
    </Link>
  );
}

/** `/admin`: the platform at a glance and the queues waiting for staff. */
export function OverviewPage() {
  const t = useTranslations('admin.overview');
  const f = useAdminFmt();
  const { data: o, error, refetch } = useOverview();
  if (error && !o) return <ErrorView error={error} retry={() => void refetch()} home={null} />;
  if (!o) return <Loading />;
  const q = o.queues;
  return (
    <>
      <PageHead
        title={t('title')}
        sub={t('sub', {
          shops: f.int(o.counts.shops),
          users: f.int(o.counts.users),
          listings: f.int(o.counts.listings),
        })}
      />
      <div className={s.kpis}>
        <Kpi
          label={t('gmv30')}
          value={f.money0(o.last30.gmv)}
          cur={o.last30.gmv}
          prev={o.previous30.gmv}
        />
        <Kpi
          label={t('orders30')}
          value={f.int(o.last30.orders)}
          cur={o.last30.orders}
          prev={o.previous30.orders}
        />
        <Kpi
          label={t('commission30')}
          value={f.money(o.last30.commission)}
          cur={o.last30.commission}
          prev={o.previous30.commission}
        />
        <Kpi
          label={t('newUsers30')}
          value={f.int(o.last30.newUsers)}
          cur={o.last30.newUsers}
          prev={o.previous30.newUsers}
        />
      </div>

      <h2 className={s.secT} style={{ margin: '20px 0 10px' }}>
        {t('attention')}
      </h2>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        }}
      >
        <Queue
          icon="check"
          n={f.int(q.pendingVerifications)}
          label={t('q.verify')}
          href="/admin/shops?verification=PENDING&sort=pending"
          urgent={q.pendingVerifications > 0}
        />
        <Queue
          icon="orders"
          n={f.int(q.stuckOrders)}
          label={t('q.stuck')}
          href="/admin/orders?status=open"
          urgent={q.stuckOrders > 0}
        />
        <Queue
          icon="receipt"
          n={f.money0(q.payoutsDue)}
          label={t('q.payouts', { n: q.payoutShops })}
          href="/admin/payouts"
        />
        <Queue
          icon="star"
          n={f.int(q.lowReviews7d)}
          label={t('q.lowReviews')}
          href="/admin/reviews?status=low"
        />
        <Queue
          icon="store"
          n={f.int(q.suspendedShops)}
          label={t('q.suspendedShops')}
          href="/admin/shops?status=suspended"
        />
        <Queue
          icon="users"
          n={f.int(q.suspendedUsers)}
          label={t('q.suspendedUsers')}
          href="/admin/users?status=suspended"
        />
      </div>

      <div className={s.cols} style={{ marginTop: 20 }}>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('chartTitle')}</h2>
            <span className={cx(s.small, s.muted)}>
              {t('today')}: {f.money(o.today.gmv)} · {t('ordersN', { n: o.today.orders })}
            </span>
          </div>
          <div className={s.panelB}>
            <GmvChart days={o.days} />
          </div>
        </section>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('topShops')}</h2>
          </div>
          <div className={s.panelB} style={{ display: 'grid', gap: 10 }}>
            {o.topShops.length === 0 && <span className={s.muted}>{t('noSales')}</span>}
            {o.topShops.map((x, i) => (
              <Link
                key={x.id}
                href={`/admin/shops/${x.id}`}
                className={s.noUnderline}
                style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}
              >
                <span className={cx(s.small, s.muted, s.num)} style={{ width: 14 }}>
                  {i + 1}
                </span>
                <Avatar name={x.name} url={x.logoUrl} size={30} square />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className={s.ellipsis} style={{ display: 'block' }}>
                    {x.name}
                  </span>
                  <span className={cx(s.tiny, s.muted)}>{t('ordersN', { n: x.orders })}</span>
                </span>
                <strong className={s.num}>{f.money0(x.gmv)}</strong>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className={s.kpis} style={{ marginTop: 20 }}>
        <Kpi
          label={t('gmv7')}
          value={f.money0(o.last7.gmv)}
          sub={t('ordersN', { n: o.last7.orders })}
        />
        <Kpi
          label={t('bookings30')}
          value={f.int(o.last30.bookings)}
          cur={o.last30.bookings}
          prev={o.previous30.bookings}
        />
        <Kpi
          label={t('newShops30')}
          value={f.int(o.last30.newShops)}
          cur={o.last30.newShops}
          prev={o.previous30.newShops}
        />
        <Kpi
          label={t('shopMix')}
          value={`${f.int(o.counts.productShops)} / ${f.int(o.counts.serviceShops)}`}
          sub={t('shopMixSub')}
        />
      </div>
    </>
  );
}
