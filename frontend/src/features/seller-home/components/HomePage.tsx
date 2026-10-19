'use client';

import { useTranslations } from 'next-intl';

import { useOrderActions } from '@/features/seller-orders';
import {
  cx,
  DAY,
  itemCount,
  lowVars,
  orderCustomer,
  ms,
  posSalesFrom,
  saleNet,
  series,
  s,
  Thumb,
  today0,
  useDb,
  useFmt,
  type SellerOrder,
  useMethodName,
} from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

const LATE = 30 * 60_000;

function BarChart({ data, t0 }: { data: { d: number; v: number }[]; t0: number }) {
  const t = useTranslations('seller.home');
  const f = useFmt();
  const W = 640;
  const H = 200;
  const P = { l: 44, r: 8, t: 12, b: 26 };
  const max = Math.max(50, ...data.map((x) => x.v));
  const nice = Math.ceil(max / 500) * 500 || 500;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  return (
    <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chartLabel')}>
      {[0, 0.5, 1].map((fr) => (
        <g key={fr}>
          <line x1={P.l} x2={W - P.r} y1={y(nice * fr)} y2={y(nice * fr)} />
          <text x={P.l - 6} y={y(nice * fr) + 4} textAnchor="end">
            ${((nice * fr) / 1000).toFixed((nice * fr) % 1000 ? 1 : 0)}k
          </text>
        </g>
      ))}
      {data.map((x, i) => (
        <g key={x.d}>
          <rect
            className={x.d === t0 ? `${s.bar} ${s.barToday}` : s.bar}
            x={P.l + i * bw + bw * 0.18}
            y={y(x.v)}
            width={bw * 0.64}
            height={Math.max(0, H - P.b - y(x.v))}
            rx={3}
          >
            <title>{`${f.fmtD(x.d)}: ${f.money(x.v)}`}</title>
          </rect>
          {(data.length - 1 - i) % (data.length > 14 ? 5 : 2) === 0 && (
            <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle">
              {x.d === t0 ? t('today') : new Date(x.d).getDate()}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function OrderRow({ o }: { o: SellerOrder }) {
  const t = useTranslations('seller.orders');
  const tm = useTranslations('seller.method');
  const tp = useMethodName();
  const db = useDb();
  const f = useFmt();
  const act = useOrderActions();
  const c = orderCustomer(db, o);
  const n = itemCount(o);
  const pay = o.payment.channel === 'COD' ? 'COD' : o.payment.method === 'CARD' ? 'CARD' : 'KHQR';
  return (
    <div className={s.row} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
      <button
        type="button"
        className={cx(s.link, s.quiet, s.noUnderline)}
        style={{ textAlign: 'left', minWidth: 0 }}
        onClick={() => act.open(o.id)}
      >
        <span className={cx(s.who, s.block)}>
          {o.number} · {c?.name}{' '}
          <span className={cx(s.age, Date.now() - ms(o.createdAt) > LATE ? s.late : s.muted)}>
            {f.age(o.createdAt)}
          </span>
        </span>
        <span className={s.meta}>
          {t('items', { n })} · {f.money(o.total)} · {tm(o.method)} · {tp(pay)}
        </span>
      </button>
      <span style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          onClick={() => void act.reject(o.id)}
        >
          {t('reject.btn')}
        </button>
        <button
          type="button"
          className={cx(s.btn, s.btnPrimary, s.btnSm)}
          onClick={() => act.accept([o.id])}
        >
          {t('next.accept')}
        </button>
      </span>
    </div>
  );
}

export function HomePage() {
  const t = useTranslations('seller.home');
  const db = useDb();
  const f = useFmt();
  const t0 = today0();
  const now = Date.now();
  const { orders, products, reviews, pos, shop } = db;
  const at = (o: SellerOrder) => ms(o.createdAt);
  const nNew = orders.filter((o) => o.status === 'NEW');
  const nPack = orders.filter((o) => o.status === 'ACCEPTED');
  const nShip = orders.filter((o) => o.status === 'PACKED');
  const nOut = orders.filter((o) => o.status === 'SHIPPED').length;
  const low = lowVars(products);
  const unrep = reviews.filter((r) => !r.reply);
  const td = orders.filter((o) => at(o) >= t0 && o.status !== 'CANCELLED');
  const online = td.reduce((x, o) => x + o.total, 0);
  const todaySales = posSalesFrom(pos.sales, t0);
  const store = todaySales.reduce((x, sl) => x + saleNet(sl), 0);
  const rev = online + store;
  const lwFrom = t0 - 7 * DAY;
  const lwTo = t0 - 6 * DAY;
  const lw =
    orders
      .filter((o) => at(o) >= lwFrom && at(o) < lwTo && o.status !== 'CANCELLED')
      .reduce((x, o) => x + o.total, 0) +
    pos.sales
      .filter((sl) => ms(sl.at) >= lwFrom && ms(sl.at) < lwTo)
      .reduce((x, sl) => x + saleNet(sl), 0);
  const s30 = series(orders, pos.sales, 30, t0);
  const tot = s30.reduce((x, d) => x + d.v, 0);
  const n30 = orders.filter((o) => at(o) >= t0 - 29 * DAY && o.status !== 'CANCELLED');
  const aov = n30.length ? tot / n30.length : 0;
  const lines30 = n30.flatMap((o) => o.lines);
  const top = products
    .map((p) => {
      const ls = lines30.filter((l) => p.variants.some((v) => v.id === l.variantId));
      return { p, v: ls.reduce((x, l) => x + l.qty * l.unitPrice, 0) };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
  const maxV = top[0]?.v || 1;
  const oldest = nNew.length ? Math.min(...nNew.map(at)) : 0;
  const hour = new Date().getHours();
  const first = shop.ownerName.split(' ')[1] ?? shop.ownerName;
  const pct = lw ? Math.abs(Math.round(((rev - lw) / lw) * 100)) : 0;

  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t(hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening', { name: first })}</h1>
          <p className={s.muted}>{t('sub')}</p>
        </div>
      </div>
      <div className={s.todo}>
        <Link className={cx(s.td, nNew.length ? s.hot : s.zero)} href="/seller/orders?tab=new">
          <span className={cx(s.muted, s.small)}>{t('todo.accept')}</span>
          <span className={s.tdN}>{nNew.length}</span>
          <span className={cx(s.tiny, oldest && now - oldest > LATE ? cx(s.age, s.late) : s.muted)}>
            {nNew.length ? t('todo.oldest', { age: f.age(oldest) }) : t('todo.caughtUp')}
          </span>
        </Link>
        <Link className={cx(s.td, !nPack.length && s.zero)} href="/seller/orders?tab=pack">
          <span className={cx(s.muted, s.small)}>{t('todo.pack')}</span>
          <span className={s.tdN}>{nPack.length}</span>
          <span className={cx(s.tiny, s.muted)}>{t('todo.prep', { n: shop.prepMinutes })}</span>
        </Link>
        <Link className={cx(s.td, !nShip.length && s.zero)} href="/seller/orders?tab=ship">
          <span className={cx(s.muted, s.small)}>{t('todo.ready')}</span>
          <span className={s.tdN}>{nShip.length}</span>
          <span className={cx(s.tiny, s.muted)}>{t('todo.out', { n: nOut })}</span>
        </Link>
        <Link className={cx(s.td, !low.length && s.zero)} href="/seller/inventory?f=low">
          <span className={cx(s.muted, s.small)}>{t('todo.low')}</span>
          <span className={s.tdN}>{low.length}</span>
          <span className={cx(s.tiny, s.muted)}>
            {t('todo.soldOut', { n: low.filter(([, v]) => v.stock === 0).length })}
          </span>
        </Link>
      </div>
      <div className={s.kpis}>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('kpi.salesToday')}</span>
          <span className={s.kpiV}>{f.money(rev)}</span>
          <span className={s.kpiS}>
            {lw ? (
              <>
                <span className={rev >= lw ? s.up : s.down}>
                  {rev >= lw ? '▲' : '▼'} {pct}%
                </span>{' '}
                {t('kpi.vsLast', { day: f.weekday(now) })}
              </>
            ) : (
              ' '
            )}
          </span>
        </div>
        <Link className={s.kpi} href="/seller/pos">
          <span className={s.kpiL}>{t('kpi.storeVsOnline')}</span>
          <span className={s.kpiV} style={{ fontSize: 20 }}>
            {f.money0(store)}{' '}
            <span className={s.muted} style={{ fontWeight: 400 }}>
              /
            </span>{' '}
            {f.money0(online)}
          </span>
          <span className={s.kpiS}>
            {t('kpi.counts', { store: todaySales.length, online: td.length })}
          </span>
        </Link>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('kpi.aov')}</span>
          <span className={s.kpiV}>{f.money(aov)}</span>
          <span className={s.kpiS}>{t('kpi.orders', { n: n30.length })}</span>
        </div>
        <Link className={s.kpi} href="/seller/reviews">
          <span className={s.kpiL}>{t('kpi.reviews')}</span>
          <span className={s.kpiV}>{unrep.length}</span>
          <span className={s.kpiS}>
            {t('kpi.lowStars', { n: unrep.filter((r) => r.stars <= 3).length })}
          </span>
        </Link>
      </div>
      <div className={s.cols}>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('sales30')}</h2>
            <span className={s.num}>
              <b>{f.money0(tot)}</b>
            </span>
          </div>
          <div className={s.panelB}>
            <BarChart data={s30} t0={t0} />
          </div>
        </section>
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('best30')}</h2>
          </div>
          <div className={s.panelB} style={{ gap: 0 }}>
            {!top.length && <p className={cx(s.small, s.muted)}>{t('noBest')}</p>}
            {top.map((x) => (
              <Link key={x.p.id} className={s.hbar} href={`/seller/products/${x.p.id}`}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <Thumb p={x.p} size={28} />
                  <span className={s.ellipsis}>{x.p.title}</span>
                </span>
                <i>
                  <b style={{ width: `${(x.v / maxV) * 100}%` }} />
                </i>
                <span className={s.num} style={{ textAlign: 'right' }}>
                  {f.money0(x.v)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      {nNew.length > 0 && (
        <section className={s.panel}>
          <div className={s.panelH}>
            <h2>{t('acceptThese')}</h2>
            <Link className={cx(s.link, s.small)} href="/seller/orders">
              {t('allOrders')}
            </Link>
          </div>
          {nNew.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </section>
      )}
    </>
  );
}
