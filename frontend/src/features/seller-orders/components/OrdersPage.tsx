'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  cx,
  Ic,
  itemCount,
  ms,
  ORDER_TABS,
  orderCustomer,
  PayPill,
  payLabel,
  s,
  StatusPill,
  tabOf,
  Thumb,
  useDb,
  useFmt,
  useUi,
  type OrderTab,
  type SellerOrder,
  useMethodName,
} from '@/features/seller-shared';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { formatPhone } from '@/lib/utils/phone';

import { useOrderActions } from '../hooks/useOrderActions';
import { SourcePill } from './SourcePill';

const LATE = 30 * 60_000;

/** Next-step button per status: [action, label key]. */
function nextStep(o: SellerOrder): ['accept' | 'pack' | 'ship', string] | null {
  if (o.status === 'NEW') return ['accept', 'accept'];
  if (o.status === 'ACCEPTED') return ['pack', 'pack'];
  if (o.status === 'PACKED') return ['ship', o.method === 'PICKUP' ? 'pickedUp' : 'handToRider'];
  return null;
}

export function OrdersPage() {
  const t = useTranslations('seller.orders');
  const tm = useTranslations('seller.method');
  const tp = useMethodName();
  const db = useDb();
  const f = useFmt();
  const act = useOrderActions();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get('tab') as OrderTab | null;
  const tab: OrderTab = tabParam && ORDER_TABS.includes(tabParam) ? tabParam : 'new';
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Deep link from a notification: /seller/orders?order=<id>
  const orderParam = params.get('order');
  useEffect(() => {
    if (orderParam && db.orders.some((o) => o.id === orderParam)) {
      useUi.getState().open({ kind: 'order', id: orderParam });
      const next = new URLSearchParams(params.toString());
      next.delete('order');
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
    }
  }, [orderParam, db.orders, params, pathname, router]);

  const cust = (o: SellerOrder) => orderCustomer(db, o);
  const prod = (variantId: string) =>
    db.products.find((p) => p.variants.some((v) => v.id === variantId));

  const query = q.trim().toLowerCase();
  const list = db.orders
    .filter((o) => tab === 'all' || tabOf(o) === tab)
    .filter((o) => {
      if (!query) return true;
      const c = cust(o);
      return (
        o.number +
        c.name +
        c.phone +
        formatPhone(c.phone) +
        o.lines.map((l) => l.title).join(' ')
      )
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 60);
  const cnt = (k: OrderTab) => db.orders.filter((o) => k === 'all' || tabOf(o) === k).length;
  const bulk = (
    {
      new: ['accept', 'bulkAccept'],
      pack: ['pack', 'bulkPack'],
      ship: ['ship', 'bulkShip'],
    } as const
  )[tab as 'new' | 'pack' | 'ship'] as readonly [string, string] | undefined;
  const selected = [...sel].filter((id) => list.some((o) => o.id === id));

  const setTab = (k: OrderTab) => {
    setSel(new Set());
    router.push(`/seller/orders?tab=${k}`);
  };
  const runBulk = () => {
    if (tab === 'new') void act.accept(selected);
    else if (tab === 'pack') void act.bulkPack(selected);
    else void act.bulkShip(selected);
    setSel(new Set());
  };
  const runNext = (o: SellerOrder) => {
    const n = nextStep(o);
    if (!n) return;
    if (n[0] === 'accept') void act.accept([o.id]);
    else if (n[0] === 'pack') act.pack(o.id);
    else void act.ship(o.id);
  };
  const late = (o: SellerOrder) => o.status === 'NEW' && Date.now() - ms(o.createdAt) > LATE;
  const items = (n: number) => t('items', { n });

  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('title')}</h1>
          <p className={cx(s.muted, s.flow)}>{t.rich('flow', { b: (c) => <b>{c}</b> })}</p>
        </div>
        <button
          type="button"
          className={cx(s.btn, s.btnGhost)}
          onClick={() => useUi.getState().open({ kind: 'manual' })}
        >
          <Ic name="plus" size={18} />
          {t('manual')}
        </button>
      </div>
      <div className={s.tabs} role="tablist">
        {ORDER_TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={cx(tab === k && s.on)}
            onClick={() => setTab(k)}
          >
            {t(`tabs.${k}`)}
            {k !== 'all' && k !== 'done' && k !== 'cancelled' && (
              <span className={cx(s.ct, s.num, k === 'new' && cnt(k) > 0 && s.hot)}>{cnt(k)}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className={s.search}>
          <Ic name="search" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPh')}
            aria-label={t('searchLabel')}
          />
        </div>
      </div>
      <section className={s.panel}>
        {selected.length > 0 && bulk && (
          <div className={s.bulk}>
            <b>{t('selected', { n: selected.length })}</b>
            <button type="button" className={cx(s.btn, s.btnPrimary, s.btnSm)} onClick={runBulk}>
              {t(bulk[1] as 'bulkAccept')}
            </button>
            <button
              type="button"
              className={cx(s.link, s.quiet, s.small)}
              style={{ color: 'inherit' }}
              onClick={() => setSel(new Set())}
            >
              {t('clear')}
            </button>
          </div>
        )}
        {list.length ? (
          <>
            <div className={s.ocards}>
              {list.map((o) => {
                const c = cust(o);
                const n = nextStep(o);
                return (
                  <div
                    key={o.id}
                    className={s.oc2}
                    role="button"
                    tabIndex={0}
                    onClick={() => act.open(o.id)}
                    onKeyDown={(e) => e.key === 'Enter' && act.open(o.id)}
                  >
                    <Thumb p={prod(o.lines[0]?.variantId ?? '')} />
                    <span style={{ minWidth: 0 }}>
                      <b className={s.num}>{o.number}</b> · {c.name}
                      <span className={cx(s.tiny, s.muted, s.block)}>
                        {items(itemCount(o))} · {tm(o.method)} · {tp(payLabel(o))}
                        {(o.status === 'NEW' || o.status === 'ACCEPTED') && (
                          <>
                            {' · '}
                            <span className={cx(s.age, late(o) && s.late)}>
                              {f.age(o.createdAt)}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <b className={s.num}>{f.money(o.total)}</b>
                      <span className={s.block}>
                        <StatusPill status={o.status} /> <SourcePill o={o} />
                      </span>
                    </span>
                    {n && (
                      <span className={s.oc2Act}>
                        {o.status === 'NEW' && (
                          <button
                            type="button"
                            className={cx(s.btn, s.btnGhost, s.btnSm)}
                            onClick={(e) => {
                              e.stopPropagation();
                              void act.reject(o.id);
                            }}
                          >
                            {t('reject.btn')}
                          </button>
                        )}
                        <button
                          type="button"
                          className={cx(s.btn, s.btnPrimary, s.btnSm)}
                          onClick={(e) => {
                            e.stopPropagation();
                            runNext(o);
                          }}
                        >
                          {t(`next.${n[1]}` as 'next.accept')}
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={cx(s.tblWrap, s.odesk)}>
              <table>
                <thead>
                  <tr>
                    {bulk && (
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          aria-label={t('selectAll')}
                          checked={selected.length === list.length}
                          onChange={(e) =>
                            setSel(e.target.checked ? new Set(list.map((o) => o.id)) : new Set())
                          }
                        />
                      </th>
                    )}
                    <th>{t('col.order')}</th>
                    <th>{t('col.customer')}</th>
                    <th>{t('col.items')}</th>
                    <th>{t('col.delivery')}</th>
                    <th>{t('col.payment')}</th>
                    <th>{t('col.status')}</th>
                    <th className={s.r}>{t('col.total')}</th>
                    {bulk && <th />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => {
                    const c = cust(o);
                    const n = nextStep(o);
                    const first = o.lines[0];
                    return (
                      <tr
                        key={o.id}
                        className={s.clk}
                        tabIndex={0}
                        onClick={() => act.open(o.id)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && e.target === e.currentTarget && act.open(o.id)
                        }
                      >
                        {bulk && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={t('selectOne', { no: o.number })}
                              checked={sel.has(o.id)}
                              onChange={(e) => {
                                const next = new Set(sel);
                                if (e.target.checked) next.add(o.id);
                                else next.delete(o.id);
                                setSel(next);
                              }}
                            />
                          </td>
                        )}
                        <td>
                          <b className={s.num}>{o.number}</b>
                          <div className={cx(s.age, late(o) ? s.late : s.muted)}>
                            {o.status === 'NEW' || o.status === 'ACCEPTED'
                              ? t('waiting', { age: f.age(o.createdAt) })
                              : f.fmtDT(o.createdAt)}
                          </div>
                        </td>
                        <td>
                          {c.name}
                          <div className={cx(s.tiny, s.muted)}>{c.district}</div>
                        </td>
                        <td>
                          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Thumb p={prod(first?.variantId ?? '')} size={28} />
                            <span className={s.small}>
                              {first?.title}
                              {o.lines.length > 1 && (
                                <span className={s.muted}> +{o.lines.length - 1}</span>
                              )}
                              <span className={cx(s.tiny, s.muted, s.block)}>
                                {items(itemCount(o))}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className={cx(s.pill, s.neutral)}>
                            <Ic name={o.method === 'PICKUP' ? 'store' : 'truck'} size={12} />{' '}
                            {tm(o.method)}
                          </span>
                        </td>
                        <td>
                          <PayPill o={o} />
                        </td>
                        <td>
                          <StatusPill status={o.status} /> <SourcePill o={o} />
                        </td>
                        <td className={cx(s.r, s.num)}>
                          <b>{f.money(o.total)}</b>
                        </td>
                        {bulk && (
                          <td className={s.r} onClick={(e) => e.stopPropagation()}>
                            {n && (
                              <button
                                type="button"
                                className={cx(
                                  s.btn,
                                  o.status === 'NEW' ? s.btnPrimary : s.btnGhost,
                                  s.btnSm,
                                )}
                                onClick={() => runNext(o)}
                              >
                                {t(`next.${n[1]}` as 'next.accept')}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className={s.empty}>
            <Ic name="orders" size={30} />
            <strong>
              {query
                ? t('empty.noMatch')
                : tab === 'new' || tab === 'pack' || tab === 'ship'
                  ? t(`empty.${tab}`)
                  : t('empty.none')}
            </strong>
            <span>{tab === 'new' && !query ? t('empty.newHint') : ''}</span>
          </div>
        )}
      </section>
    </>
  );
}
