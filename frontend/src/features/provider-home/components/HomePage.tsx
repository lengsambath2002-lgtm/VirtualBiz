'use client';

import { Link } from '@/lib/i18n/navigation';

import { StatusPill } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useUi } from '@/features/provider-shared/store';
import {
  apptEnd,
  conflicts,
  firstName,
  isActive,
  pending,
  revenueSeries,
  shiftOf,
} from '@/features/provider-shared/util/logic';
import {
  addDays,
  DAY_MS,
  fmtD,
  fmtDL,
  fmtWeekdayLong,
  hm,
  msOf,
  nowMin,
  todayIso,
} from '@/features/provider-shared/util/time';

/** Home: greeting, KPIs, next up, approvals, 14-day chart, top services (prototype `P.home`). */
export function HomePage() {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const act = useActions();
  const today = todayIso();
  const t0 = msOf(today);
  const tA = d.appointments
    .filter((a) => a.date === today && isActive(a) && a.status !== 'REQUESTED')
    .sort((a, b) => a.start - b.start);
  const sumSales = (lo: number, hi: number) =>
    d.sales
      .filter((s) => Date.parse(s.at) >= lo && Date.parse(s.at) < hi)
      .reduce((x, s) => x + s.total, 0);
  const rev = sumSales(t0, Infinity);
  const wkAgo = sumSales(t0 - 7 * DAY_MS, t0 - 6 * DAY_MS);
  const exp = tA.filter((a) => a.status !== 'COMPLETED').reduce((x, a) => x + a.price, 0);
  const cap = d.staff.reduce((x, m) => {
    const sh = shiftOf(d.business, m, today);
    return x + (sh ? sh[1] - sh[0] : 0);
  }, 0);
  const bookedMin = tA.reduce((x, a) => x + a.durationMin, 0);
  const occ = cap ? Math.round((bookedMin / cap) * 100) : 0;
  const nm = nowMin();
  const next = tA.filter((a) => apptEnd(a) > nm && a.status !== 'COMPLETED').slice(0, 5);
  const req = pending(d);
  const s14 = revenueSeries(d.sales, 14, today);
  const tot14 = s14.reduce((x, s) => x + s.v, 0);
  const from30 = addDays(today, -30);
  const svcRev = d.services
    .map((s) => ({
      s,
      v: d.appointments
        .filter((a) => a.serviceId === s.id && a.status === 'COMPLETED' && a.date > from30)
        .reduce((x, a) => x + a.price, 0),
    }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
  const maxS = svcRev[0]?.v || 1;
  const greet = nm < 720 ? 'morning' : nm < 1080 ? 'afternoon' : 'evening';
  const up = rev >= wkAgo;
  const oldest = req.length ? Math.min(...req.map((r) => Date.parse(r.createdAt))) : 0;

  return (
    <>
      <div className={k('ph-h')}>
        <div>
          <h1>{t(`home.${greet}`, { name: firstName(d.business.ownerName) })}</h1>
          <p className={k('muted')}>{fmtDL(today, locale)}</p>
        </div>
        <Link href="/provider/calendar" className={k('btn btn-ghost')}>
          <PIcon name="cal" size={18} />
          {t('home.openCalendar')}
        </Link>
      </div>
      <div className={k('kpis')}>
        <div className={k('kpi')}>
          <span className={k('l')}>{t('home.salesToday')}</span>
          <span className={k('v')}>{f.money(rev)}</span>
          <span className={k('s')}>
            {wkAgo ? (
              <>
                {t.rich('home.vsLast', {
                  arrow: up ? '▲' : '▼',
                  pct: Math.abs(Math.round(((rev - wkAgo) / wkAgo) * 100)),
                  weekday: fmtWeekdayLong(today, locale),
                  c: (ch) => <span className={k(up ? 'up' : 'down')}>{ch}</span>,
                })}{' '}
                ·{' '}
              </>
            ) : null}
            {t('home.stillExpected', { amount: f.money0(exp) })}
          </span>
        </div>
        <button type="button" className={k('kpi')} onClick={() => act.go('calendar')}>
          <span className={k('l')}>{t('home.apptsToday')}</span>
          <span className={k('v')}>{tA.length}</span>
          <span className={k('s')}>{t('home.stillToCome', { n: next.length })}</span>
        </button>
        <div className={k('kpi')}>
          <span className={k('l')}>{t('home.chairs')}</span>
          <span className={k('v')}>{occ}%</span>
          <span className={k('s')}>
            {t('home.staffHours', {
              booked: Math.round(bookedMin / 60),
              cap: Math.round(cap / 60),
            })}
          </span>
        </div>
        <button
          type="button"
          className={k('kpi', req.length && 'attn')}
          onClick={() => ui.open({ t: 'requests' })}
        >
          <span className={k('l')}>
            {t('home.requests')}{' '}
            {req.length > 0 && <span className={k('pill warn')}>{t('home.action')}</span>}
          </span>
          <span className={k('v')}>{req.length}</span>
          <span className={k('s')}>
            {req.length ? t('home.oldest', { ago: f.ago(oldest) }) : t('home.allAnswered')}
          </span>
        </button>
      </div>
      <div className={k('cols')}>
        <section className={k('panel')}>
          <div className={k('panel-h')}>
            <h2>{t('home.nextUp')}</h2>
            <Link className={k('link small')} href="/provider/calendar">
              {t('home.calendarLink')}
            </Link>
          </div>
          {next.length ? (
            next.map((a) => {
              const c = d.clients.find((x) => x.id === a.clientId);
              const st = d.staff.find((x) => x.id === a.staffId);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={k('row')}
                  onClick={() => act.openAppt(a.id)}
                >
                  <span className={k('t num')}>{hm(a.start)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className={k('who')}>{c?.name}</span>
                    <span className={k('meta')}>
                      <span style={{ color: st?.color, fontWeight: 600 }}>●</span>
                      {d.services.find((s) => s.id === a.serviceId)?.name} ·{' '}
                      {firstName(st?.name ?? '')}
                    </span>
                  </span>
                  {a.start <= nm ? (
                    <span className={k('pill ok')}>{t('home.inChair')}</span>
                  ) : (
                    <StatusPill status={a.status} />
                  )}
                </button>
              );
            })
          ) : (
            <div className={k('empty')}>
              <strong>{t('home.nothingElse')}</strong>
              <span>{t('home.walkinsHint')}</span>
            </div>
          )}
        </section>
        <section className={k('panel')}>
          <div className={k('panel-h')}>
            <h2>{t('home.waiting')}</h2>
            <span className={k('tiny muted')}>{t('home.autoOff')}</span>
          </div>
          {req.length ? (
            req.map((a) => {
              const c = d.clients.find((x) => x.id === a.clientId);
              const cl = conflicts(d, a);
              return (
                <div
                  key={a.id}
                  className={k('row')}
                  style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}
                >
                  <button
                    type="button"
                    className={k('link quiet')}
                    style={{ textAlign: 'left', textDecoration: 'none', minWidth: 0 }}
                    onClick={() => act.openAppt(a.id)}
                  >
                    <span className={k('who')} style={{ display: 'block' }}>
                      {c?.name}
                    </span>
                    <span className={k('meta num')}>
                      {d.services.find((s) => s.id === a.serviceId)?.name} · {f.rel(a.date, today)}{' '}
                      {hm(a.start)}
                    </span>
                    {cl[0] && (
                      <span className={k('tiny')} style={{ color: 'var(--accent-ink)' }}>
                        {t('home.clash', { text: f.conflict(cl[0]) })}
                      </span>
                    )}
                  </button>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={k('btn btn-ghost btn-sm')}
                      onClick={() => void act.decline(a.id)}
                    >
                      {t('appt.decline')}
                    </button>
                    <button
                      type="button"
                      className={k('btn btn-primary btn-sm')}
                      onClick={() => void act.accept(a.id)}
                    >
                      {t('appt.accept')}
                    </button>
                  </span>
                </div>
              );
            })
          ) : (
            <div className={k('empty')}>
              <strong>{t('home.allCaught')}</strong>
            </div>
          )}
        </section>
      </div>
      <div className={k('cols')}>
        <section className={k('panel')}>
          <div className={k('panel-h')}>
            <h2>{t('home.sales14')}</h2>
            <span className={k('num')}>
              <b>{f.money0(tot14)}</b> <span className={k('muted small')}>{t('home.total')}</span>
            </span>
          </div>
          <div className={k('panel-b')}>
            <BarChart series={s14} today={today} />
          </div>
        </section>
        <section className={k('panel')}>
          <div className={k('panel-h')}>
            <h2>{t('home.topServices')}</h2>
            <Link className={k('link small')} href="/provider/sales">
              {t('home.salesLink')}
            </Link>
          </div>
          <div className={k('panel-b')} style={{ gap: 0 }}>
            {!svcRev.length && <p className={k('small muted')}>{t('home.noTopServices')}</p>}
            {svcRev.map((x) => (
              <div key={x.s.id} className={k('hbar')}>
                <span
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {x.s.name}
                </span>
                <i>
                  <b
                    style={{
                      width: `${(x.v / maxS) * 100}%`,
                      background: d.staff.find((m) => m.id === x.s.staffIds[0])?.color,
                    }}
                  />
                </i>
                <span className={k('num')} style={{ textAlign: 'right' }}>
                  {f.money0(x.v)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/** Revenue bars (prototype `barChart`). */
function BarChart({ series, today }: { series: { d: string; v: number }[]; today: string }) {
  const f = useFmt();
  const { t, locale } = f;
  const W = 640;
  const H = 200;
  const P = { l: 36, r: 8, t: 12, b: 26 };
  const max = Math.max(10, ...series.map((s) => s.v));
  const nice = Math.ceil(max / 25) * 25;
  const bw = (W - P.l - P.r) / series.length;
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  return (
    <svg
      className={k('chart')}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('home.chartLabel', { n: series.length })}
    >
      {[0, 0.5, 1].map((fr) => (
        <g key={fr}>
          <line className={k('gl')} x1={P.l} x2={W - P.r} y1={y(nice * fr)} y2={y(nice * fr)} />
          <text x={P.l - 6} y={y(nice * fr) + 4} textAnchor="end">
            ${Math.round(nice * fr)}
          </text>
        </g>
      ))}
      {series.map((s, i) => (
        <g key={s.d}>
          <rect
            className={k('b', s.d === today && 'today')}
            x={P.l + i * bw + bw * 0.18}
            y={y(s.v)}
            width={bw * 0.64}
            height={Math.max(0, H - P.b - y(s.v))}
            rx={3}
          >
            <title>{`${fmtD(s.d, locale)}: ${f.money(s.v)}`}</title>
          </rect>
          {(i % 2 === (series.length - 1) % 2 || series.length <= 7) && (
            <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">
              {s.d === today ? t('time.today') : Number(s.d.slice(8))}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
