'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { ErrorView } from '@/components/feedback';
import { useOverview } from '@/features/admin-shared/api';
import { Avatar, Loading, PageHead, Seg } from '@/features/admin-shared/components/ui';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import type { Overview, OverviewRange } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, Ic, s, type IcName } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

import o from './overview.module.css';

const RANGES: OverviewRange[] = [7, 30, 90];
const KEYS = ['range'] as const;

type Change = { kind: 'new' } | { kind: 'pct'; v: number } | { kind: 'x'; v: number };

/** How `cur` compares with `prev`: a percentage, "N×" for big jumps, "new" from nothing. */
function change(cur: number, prev: number): Change | null {
  if (!cur && !prev) return null;
  if (!prev) return { kind: 'new' };
  if (cur / prev >= 10) return { kind: 'x', v: Math.round((cur / prev) * 10) / 10 };
  return { kind: 'pct', v: Math.round(((cur - prev) / prev) * 100) };
}

function ChangeChip({ cur, prev }: { cur: number; prev: number }) {
  const t = useTranslations('admin.overview');
  const c = change(Number(cur), Number(prev));
  if (!c) return <span>—</span>;
  if (c.kind === 'new') return <span className={cx(o.chip, o.chipNew)}>{t('changeNew')}</span>;
  const up = c.kind === 'x' || c.v > 0;
  const flat = c.kind === 'pct' && c.v === 0;
  return (
    <span className={cx(o.chip, flat ? o.chipFlat : up ? o.chipUp : o.chipDown)}>
      {flat ? '' : up ? '▲' : '▼'} {c.kind === 'x' ? `${c.v}×` : `${Math.abs(c.v)}%`}
    </span>
  );
}

/** A tiny trend line under a KPI. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 200;
  const H = 34;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 2 - (v / max) * (H - 4)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)},${y!.toFixed(1)}`).join('');
  return (
    <svg className={o.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path className={o.area} d={`${line}L${W},${H}L0,${H}Z`} />
      <path d={line} />
    </svg>
  );
}

function Kpi({
  label,
  value,
  cur,
  prev,
  days,
  spark,
}: {
  label: string;
  value: string;
  cur: number;
  prev: number;
  days: number;
  spark?: number[];
}) {
  const t = useTranslations('admin.overview');
  return (
    <div className={cx(s.kpi, o.kpi)}>
      <span className={o.kpiL}>{label}</span>
      <span className={o.kpiV}>{value}</span>
      <span className={o.kpiS}>
        <ChangeChip cur={cur} prev={prev} />
        {t('vsPrev', { n: days })}
      </span>
      {spark && <Spark values={spark} />}
    </div>
  );
}

function Queue({
  icon,
  n,
  value,
  label,
  href,
  tone,
}: {
  icon: IcName;
  n: number;
  value?: ReactNode;
  label: string;
  href: string;
  tone: 'urgent' | 'warn' | 'calm';
}) {
  const clear = n === 0;
  return (
    <Link
      href={href}
      className={cx(
        s.panel,
        s.noUnderline,
        o.queue,
        clear ? o.qClear : tone === 'urgent' ? o.qUrgent : tone === 'warn' && o.qWarn,
      )}
    >
      <span className={o.qIc}>
        <Ic name={clear ? 'check' : icon} size={18} />
      </span>
      <span>
        <span className={o.qN}>{value ?? n}</span>
        <span className={o.qL}>{label}</span>
      </span>
      <span className={o.qGo} aria-hidden>
        <Ic name="right" size={16} />
      </span>
    </Link>
  );
}

/** Sales or orders per day, with a tooltip for the bar under the pointer. */
function DayChart({ days, metric }: { days: Overview['days']; metric: 'gmv' | 'orders' }) {
  const t = useTranslations('admin.overview');
  const f = useAdminFmt();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 210;
  const P = { l: 48, r: 8, t: 14, b: 26 };
  const val = (d: Overview['days'][number]) => Number(metric === 'gmv' ? d.gmv : d.orders);
  const max = Math.max(metric === 'gmv' ? 50 : 4, ...days.map(val));
  const mag = 10 ** Math.floor(Math.log10(max));
  const nice = Math.ceil(max / mag) * mag;
  const bw = (W - P.l - P.r) / Math.max(1, days.length);
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  const last = days.length - 1;
  const every = Math.max(1, Math.round(days.length / 6));
  const fmt = (v: number) => (metric === 'gmv' ? f.money0(v) : f.int(v));
  const h = hover === null ? null : days[hover];
  return (
    <div className={o.chartWrap} onMouseLeave={() => setHover(null)}>
      {h && (
        <div className={o.tip} style={{ left: `${((P.l + (hover! + 0.5) * bw) / W) * 100}%` }}>
          <b>{f.money(h.gmv)}</b>
          {hover === last ? t('today') : f.day(h.date)} · {t('ordersN', { n: h.orders })}
        </div>
      )}
      <svg
        className={o.chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('chartLabel', { n: days.length })}
      >
        {[0, 0.5, 1].map((fr) => (
          <g key={fr}>
            <line x1={P.l} x2={W - P.r} y1={y(nice * fr)} y2={y(nice * fr)} />
            <text x={P.l - 6} y={y(nice * fr) + 4} textAnchor="end">
              {fmt(nice * fr)}
            </text>
          </g>
        ))}
        {days.map((d, i) => (
          <g key={d.date} onMouseEnter={() => setHover(i)}>
            {/* A full-height hit area so thin bars are easy to point at. */}
            <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
            <rect
              className={cx(
                o.bar,
                i === last && o.barToday,
                hover === i ? o.barOn : hover !== null && o.barDim,
              )}
              x={P.l + i * bw + bw * 0.16}
              y={y(val(d))}
              width={bw * 0.68}
              height={Math.max(val(d) > 0 ? 1.5 : 0, H - P.b - y(val(d)))}
              rx={Math.min(3, bw * 0.2)}
            >
              <title>{t('barTip', { day: f.day(d.date), gmv: f.money(d.gmv), n: d.orders })}</title>
            </rect>
            {(last - i) % every === 0 && (
              <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">
                {i === last ? t('today') : f.day(d.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** `/admin`: the platform at a glance for 7, 30 or 90 days, and the queues waiting for staff. */
export function OverviewPage() {
  const t = useTranslations('admin.overview');
  const f = useAdminFmt();
  const locale = useLocale();
  const { values, set } = useListParams(KEYS);
  const range = (RANGES.find((r) => String(r) === values.range) ?? 30) as OverviewRange;
  const [metric, setMetric] = useState<'gmv' | 'orders'>('gmv');
  const { data: ov, error, refetch, isFetching, dataUpdatedAt } = useOverview(range);
  if (error && !ov) return <ErrorView error={error} retry={() => void refetch()} home={null} />;
  if (!ov) return <Loading />;
  const q = ov.queues;
  const cur = ov.current;
  const prev = ov.previous;
  const n = ov.rangeDays;
  const avg = (p: typeof cur) => (p.orders ? Number(p.gmv) / p.orders : 0);
  const topMax = Math.max(1, ...ov.topShops.map((x) => Number(x.gmv)));
  const catMax = Math.max(1, ...ov.categories.map((x) => Number(x.gmv)));
  const time = new Date(dataUpdatedAt).toLocaleTimeString(locale === 'kh' ? 'km-KH' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <PageHead
        title={t('title')}
        sub={t('sub', {
          shops: f.int(ov.counts.shops),
          users: f.int(ov.counts.users),
          listings: f.int(ov.counts.listings),
        })}
        actions={
          <div className={o.head}>
            <span className={o.updated}>
              {t('updated', { time })}
              <button
                type="button"
                className={o.refresh}
                aria-label={t('refresh')}
                title={t('refresh')}
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                <Ic name="undo" size={16} />
              </button>
            </span>
            <Seg
              label={t('rangeLabel')}
              value={String(range)}
              options={RANGES.map((r) => ({ value: String(r), label: t('rangeN', { n: r }) }))}
              onChange={(v) => set({ range: v === '30' ? '' : v })}
            />
          </div>
        }
      />

      <div className={o.kpis}>
        <Kpi
          label={t('gmv')}
          value={f.money0(cur.gmv)}
          cur={cur.gmv}
          prev={prev.gmv}
          days={n}
          spark={ov.days.map((d) => Number(d.gmv))}
        />
        <Kpi
          label={t('orders')}
          value={f.int(cur.orders)}
          cur={cur.orders}
          prev={prev.orders}
          days={n}
          spark={ov.days.map((d) => d.orders)}
        />
        <Kpi label={t('aov')} value={f.money(avg(cur))} cur={avg(cur)} prev={avg(prev)} days={n} />
        <Kpi
          label={t('commission')}
          value={f.money(cur.commission)}
          cur={cur.commission}
          prev={prev.commission}
          days={n}
        />
      </div>

      <div className={o.secH}>
        <h2 className={s.secT}>{t('attention')}</h2>
      </div>
      <div className={o.queues}>
        <Queue
          icon="check"
          n={q.pendingVerifications}
          label={t('q.verify')}
          href="/admin/shops?verification=PENDING&sort=created"
          tone="urgent"
        />
        <Queue
          icon="orders"
          n={q.stuckOrders}
          label={t('q.stuck')}
          href="/admin/orders?status=open"
          tone="urgent"
        />
        <Queue
          icon="receipt"
          n={q.payoutShops}
          value={f.money0(q.payoutsDue)}
          label={t('q.payouts', { n: q.payoutShops })}
          href="/admin/payouts"
          tone="warn"
        />
        <Queue
          icon="star"
          n={q.lowReviews7d}
          label={t('q.lowReviews')}
          href="/admin/reviews?status=low"
          tone="warn"
        />
        <Queue
          icon="store"
          n={q.suspendedShops}
          label={t('q.suspendedShops')}
          href="/admin/shops?status=suspended"
          tone="calm"
        />
        <Queue
          icon="users"
          n={q.suspendedUsers}
          label={t('q.suspendedUsers')}
          href="/admin/users?status=suspended"
          tone="calm"
        />
      </div>

      <div className={o.grid2}>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t(metric === 'gmv' ? 'chartGmv' : 'chartOrders')}</h2>
            <Seg
              label={t('metricLabel')}
              value={metric}
              options={[
                { value: 'gmv', label: t('metricGmv') },
                { value: 'orders', label: t('metricOrders') },
              ]}
              onChange={setMetric}
            />
          </div>
          <DayChart days={ov.days} metric={metric} />
          <div className={cx(s.panelB, o.chartSum)} style={{ paddingTop: 0 }}>
            <span>
              {t('today')}: <b>{f.money(ov.today.gmv)}</b> · {t('ordersN', { n: ov.today.orders })}
            </span>
            <span>
              {t('dailyAvg')}: <b>{f.money(Number(cur.gmv) / n)}</b>
            </span>
          </div>
        </section>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('topShops', { n })}</h2>
            <Link href="/admin/shops?sort=gmv" className={cx(s.small, s.muted)}>
              {t('seeAll')}
            </Link>
          </div>
          <div className={o.rank}>
            {ov.topShops.length === 0 && <p className={o.empty}>{t('noSales')}</p>}
            {ov.topShops.map((x, i) => (
              <Link key={x.id} href={`/admin/shops/${x.id}`} className={o.rRow}>
                <span className={o.rNo}>{i + 1}</span>
                <Avatar name={x.name} url={x.logoUrl} size={32} square />
                <span style={{ minWidth: 0 }}>
                  <span className={o.rName}>{x.name}</span>
                  <span className={o.rSub}>{t('ordersN', { n: x.orders })}</span>
                  <span className={o.share}>
                    <i style={{ width: `${(Number(x.gmv) / topMax) * 100}%` }} />
                  </span>
                </span>
                <span className={o.rVal}>{f.money0(x.gmv)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className={o.grid2}>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('byCategory', { n })}</h2>
            <Link href="/admin/settings?tab=categories" className={cx(s.small, s.muted)}>
              {t('manageCategories')}
            </Link>
          </div>
          <div className={o.rank}>
            {ov.categories.length === 0 && <p className={o.empty}>{t('noSales')}</p>}
            {ov.categories.map((c) => (
              <div key={c.id} className={o.catRow}>
                <span>
                  {locale === 'kh' ? c.nameKh : c.name}{' '}
                  <span className={o.rSub}>· {t('ordersN', { n: c.orders })}</span>
                </span>
                <span className={o.rVal}>{f.money0(c.gmv)}</span>
                <span className={o.share}>
                  <i style={{ width: `${(Number(c.gmv) / catMax) * 100}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('growth', { n })}</h2>
          </div>
          <div className={o.growth}>
            {(
              [
                ['newUsers', cur.newUsers, prev.newUsers],
                ['newShops', cur.newShops, prev.newShops],
                ['bookings', cur.bookings, prev.bookings],
              ] as const
            ).map(([k, a, b]) => (
              <div key={k} className={o.gItem}>
                <span>{t(k)}</span>
                <b>{f.int(a)}</b>
                <span>
                  <ChangeChip cur={a} prev={b} />
                </span>
              </div>
            ))}
            <div className={o.gItem}>
              <span>{t('shopMix')}</span>
              <b>
                {f.int(ov.counts.productShops)} / {f.int(ov.counts.serviceShops)}
              </b>
              <span>{t('shopMixSub')}</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
