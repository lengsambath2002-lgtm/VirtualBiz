'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  cx,
  Ic,
  Modal,
  ms,
  posTotals,
  s,
  saleNet,
  shiftCash,
  shiftFloat,
  fetchReceiptHistory,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  type CashTenderInfo,
  type SellerPosSale,
  useMethodName,
} from '@/features/seller-shared';
import type { PaymentMethod } from '@/lib/domain';
import { useSession } from '@/lib/auth';
import { cashChange, formatCashChange, khrRate, round2 } from '@/lib/money';
import { acceptedMethods, policyOf, vatIncluded } from '@/lib/shop';
import { ShareReceipt } from '@/features/receipt-share';
import { DateRangePicker, Pagination } from '@/components/data';
import { ErrorView } from '@/components/feedback';
import { ppDay } from '@/lib/utils/dateRange';

import { focusPosSearch, usePosActions } from '../hooks/usePosActions';

const sleep = (msec: number) => new Promise((r) => setTimeout(r, msec));

export function OpenShiftDialog() {
  const t = useTranslations('seller.pos.open');
  const f = useFmt();
  const [usd, setUsd] = useState('50');
  const [khr, setKhr] = useState('40000');
  const [err, setErr] = useState('');
  const u = parseFloat(usd) || 0;
  const k = parseInt(khr.replace(/\D/g, ''), 10) || 0;
  const total = u + k / khrRate();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (total < 0) {
      setErr(t('err'));
      return;
    }
    if (!(await useSellerStore.getState().openShift(u, k))) return;
    useUi.getState().close(true);
    useUi.getState().showToast(t('done'));
    requestAnimationFrame(focusPosSearch);
  };
  return (
    <Modal>
      <h2>{t('title')}</h2>
      <p className={cx(s.muted, s.small)}>{t('hint')}</p>
      <form className={s.form} noValidate onSubmit={submit}>
        <div className={s.g2}>
          <div className={cx(s.field, err && s.bad)}>
            <label htmlFor="os-usd">{t('usd')}</label>
            <div className={s.prefix}>
              <span>$</span>
              <input
                id="os-usd"
                inputMode="decimal"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
              />
            </div>
            <div className={s.err}>{err}</div>
          </div>
          <div className={s.field}>
            <label htmlFor="os-khr">{t('khr')}</label>
            <input
              id="os-khr"
              inputMode="numeric"
              placeholder="0"
              value={khr}
              onChange={(e) => setKhr(e.target.value)}
            />
          </div>
        </div>
        <div className={s.infobox}>
          {t.rich('starting', { amount: f.money(total), b: (x) => <b className={s.num}>{x}</b> })}
        </div>
        <button type="submit" className={cx(s.btn, s.btnPrimary, s.btnBlock, s.btnLg)}>
          {t('submit')}
        </button>
      </form>
    </Modal>
  );
}

/** KHQR placeholder grid (21×21, three finder squares). */
function QrCells() {
  return (
    <>
      {Array.from({ length: 441 }, (_, k) => {
        const x = k % 21;
        const y = Math.floor(k / 21);
        const fd = (a: number, b: number) =>
          x >= a &&
          x < a + 7 &&
          y >= b &&
          y < b + 7 &&
          (x === a ||
            x === a + 6 ||
            y === b ||
            y === b + 6 ||
            (x >= a + 2 && x <= a + 4 && y >= b + 2 && y <= b + 4));
        const fin = fd(0, 0) || fd(14, 0) || fd(0, 14);
        const box = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
        return (
          <i
            key={k}
            style={{
              background: fin || (!box && (x * 7 + y * 13 + x * y) % 3 === 0) ? '#141A2B' : '#fff',
            }}
          />
        );
      })}
    </>
  );
}

type Mode = 'CASH' | 'KHQR' | 'CARD' | 'SPLIT';

export function ChargeDialog() {
  const t = useTranslations('seller.pos.charge');
  const tm = useMethodName();
  const db = useDb();
  const f = useFmt();
  const { total } = posTotals(db.pos);
  // Only what this shop takes at the counter; split is cash + KHQR.
  const accepted = acceptedMethods(db.shop.policy ?? policyOf(null));
  const modes: Mode[] = [
    ...accepted,
    ...(accepted.includes('CASH') && accepted.includes('KHQR') ? (['SPLIT'] as const) : []),
  ];
  const [mode, setMode] = useState<Mode>(modes[0] ?? 'CASH');
  const [usd, setUsd] = useState('');
  const [khr, setKhr] = useState('');
  const [split, setSplit] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = (payments: { method: PaymentMethod; amount: number }[], cash?: CashTenderInfo) => {
    const sale = useSellerStore.getState().completeSale(payments, cash);
    const ui = useUi.getState();
    ui.close(true);
    if (sale) ui.open({ kind: 'posReceipt', saleId: sale.id, fresh: true });
  };

  const body = () => {
    if (mode === 'CASH') {
      const tu = parseFloat(usd) || 0;
      const tk = parseInt(khr, 10) || 0;
      const r = cashChange({ totalUsd: total, tenderedUsd: tu, tenderedKhr: tk });
      const paid = r.paidUsd;
      const chips = [
        ...new Set([
          Math.ceil(total),
          Math.ceil(total / 5) * 5,
          Math.ceil(total / 10) * 10,
          Math.ceil(total / 20) * 20,
          Math.ceil(total / 50) * 50,
          100,
        ]),
      ]
        .filter((x) => x >= total)
        .slice(0, 5);
      return (
        <>
          <div className={s.g2}>
            <div className={s.field}>
              <label htmlFor="ch-usd">{t('usdIn')}</label>
              <div className={s.prefix}>
                <span>$</span>
                <input
                  id="ch-usd"
                  inputMode="decimal"
                  placeholder="0"
                  value={usd}
                  onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className={s.chips}>
                {chips.map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={s.chip}
                    onClick={() => setUsd(String(x))}
                  >
                    ${x}
                  </button>
                ))}
                <button type="button" className={s.chip} onClick={() => setUsd(String(total))}>
                  {t('exact')}
                </button>
              </div>
            </div>
            <div className={s.field}>
              <label htmlFor="ch-khr">{t('khrIn')}</label>
              <input
                id="ch-khr"
                inputMode="numeric"
                placeholder="0"
                value={khr}
                onChange={(e) => setKhr(e.target.value.replace(/\D/g, ''))}
              />
              <div className={s.chips}>
                {[10000, 20000, 50000, 100000].map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={s.chip}
                    onClick={() => setKhr(String((parseInt(khr, 10) || 0) + x))}
                  >
                    {t('kKhr', { n: x / 1000 })}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {paid ? (
            !r.covered ? (
              <div className={s.warnbox} style={{ fontSize: 15 }}>
                {t.rich('due', {
                  usd: f.money(r.dueUsd),
                  khr: f.riel(r.dueKhr),
                  b: (x) => <b className={s.num}>{x}</b>,
                })}
              </div>
            ) : (
              <div className={s.okbox} style={{ fontSize: 16 }}>
                {t.rich('change', {
                  amount: f.money(r.changeUsd),
                  b: (x) => <b className={s.num}>{x}</b>,
                })}
                <br />
                <span className={s.small}>
                  {t.rich('giveBack', {
                    give: formatCashChange(r.giveUsd, r.giveKhr),
                    all: f.riel(r.allKhr),
                    b: (x) => <b className={s.num}>{x}</b>,
                    n: (x) => <span className={s.num}>{x}</span>,
                  })}
                </span>
              </div>
            )
          ) : (
            <div className={s.infobox}>{t('enterTender')}</div>
          )}
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
            disabled={!(paid && r.covered)}
            onClick={() =>
              finish([{ method: 'CASH', amount: total }], { usd: tu, khr: tk, change: r.changeUsd })
            }
          >
            {t('complete')}
          </button>
        </>
      );
    }
    if (mode === 'KHQR')
      return (
        <>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10, textAlign: 'center' }}>
            <div className={s.qr2} aria-label={t('qrLabel')}>
              <QrCells />
            </div>
            <b>{db.shop.bakongId || t('noBakong')}</b>
            <span className={cx(s.small, s.muted)}>
              {t.rich('khqrHint', {
                amount: f.money(total),
                b: (x) => <b className={s.num}>{x}</b>,
              })}
            </span>
          </div>
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await sleep(800);
              finish([{ method: 'KHQR', amount: total }]);
            }}
          >
            {busy ? (
              <>
                <span className={s.spin} />
                {t('checking')}
              </>
            ) : (
              t('received')
            )}
          </button>
        </>
      );
    if (mode === 'CARD')
      return (
        <>
          <div className={s.infobox}>
            {t.rich('cardHint', {
              amount: f.money(total),
              b: (x) => <b className={s.num}>{x}</b>,
              s: (x) => <b>{x}</b>,
            })}
          </div>
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
            onClick={() => finish([{ method: 'CARD', amount: total }])}
          >
            {t('approved')}
          </button>
        </>
      );
    const c = Math.min(total, parseFloat(split) || 0);
    const rest = round2(total - c);
    return (
      <>
        <div className={s.field}>
          <label htmlFor="ch-split">{t('cashPart')}</label>
          <div className={s.prefix}>
            <span>$</span>
            <input
              id="ch-split"
              inputMode="decimal"
              placeholder="0"
              value={split}
              onChange={(e) => setSplit(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </div>
        </div>
        <div className={s.sum}>
          <div>
            <span className={s.muted}>{tm('CASH')}</span>
            <span>{f.money(c)}</span>
          </div>
          <div>
            <span className={s.muted}>{tm('KHQR')}</span>
            <span>{f.money(rest)}</span>
          </div>
        </div>
        <button
          type="button"
          className={cx(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
          disabled={!(c > 0 && rest > 0)}
          onClick={() =>
            finish([
              { method: 'CASH', amount: c },
              { method: 'KHQR', amount: rest },
            ])
          }
        >
          {t('splitDone')}
        </button>
      </>
    );
  };

  return (
    <Modal wide>
      <h2>
        {t('title')} <span className={s.num}>{f.money(total)}</span>{' '}
        <span className={cx(s.muted, s.num)} style={{ fontWeight: 500, fontSize: 15 }}>
          · {f.khr(total)}
        </span>
      </h2>
      <div className={s.seg} style={{ justifySelf: 'start' }}>
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            className={cx(mode === m && s.on)}
            onClick={() => setMode(m)}
          >
            {tm(m)}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 16 }}>{body()}</div>
    </Modal>
  );
}

export function ReceiptDialog({ saleId, fresh }: { saleId: string; fresh: boolean }) {
  const t = useTranslations('seller.pos.receipt');
  const tm = useMethodName();
  const db = useDb();
  const f = useFmt();
  const me = useSession().user;
  const sale = db.pos.sales.find((x) => x.id === saleId);
  if (!sale) return null;
  const refunded = sale.refunds.reduce((x, r) => x + r.amount, 0);
  const policy = db.shop.policy ?? policyOf(null);
  const cashier = sale.byName ?? me?.name ?? db.shop.ownerName;
  const vat = vatIncluded(sale.total - refunded, Number(policy.taxPct));
  const change = sale.cash?.change ?? 0;
  const give = cashChange({ totalUsd: 0, tenderedUsd: change, tenderedKhr: 0 });
  const ui = useUi.getState();
  return (
    <Modal>
      <h2>{fresh ? t('complete') : t('title', { no: sale.number })}</h2>
      {fresh && change > 0.004 && (
        <div className={s.okbox} style={{ fontSize: 16 }}>
          {t.rich('giveChange', {
            give: formatCashChange(give.giveUsd, give.giveKhr),
            b: (x) => <b className={s.num}>{x}</b>,
          })}
        </div>
      )}
      <div className={cx(s.receipt, s.num)}>
        <div>
          <b>{db.shop.name}</b>
          <span>{sale.number || t('sending')}</span>
        </div>
        {policy.receiptHeader && (
          <div>
            <span>{policy.receiptHeader}</span>
          </div>
        )}
        <div>
          <span>{f.dateTimeMedium(sale.at)}</span>
          <span>{cashier}</span>
        </div>
        <hr />
        {sale.lines.map((l, i) => (
          <div key={i}>
            <span>
              {l.qty} × {l.title}
              {l.variantName ? ` (${l.variantName})` : ''}
            </span>
            <span>{f.money(l.qty * l.unitPrice)}</span>
          </div>
        ))}
        <hr />
        {sale.discount > 0 && (
          <div>
            <span>{t('discount')}</span>
            <span>−{f.money(sale.discount)}</span>
          </div>
        )}
        <div>
          <b>{t('total')}</b>
          <b>{f.money(sale.total)}</b>
        </div>
        <div>
          <span>{t('riel')}</span>
          <span>{f.khr(sale.total)}</span>
        </div>
        {sale.payments.map((p, i) => (
          <div key={i}>
            <span>{t('paid', { m: tm(p.method) })}</span>
            <span>{f.money(p.amount)}</span>
          </div>
        ))}
        {sale.cash && sale.cash.usd + sale.cash.khr > 0 && (
          <div>
            <span>{t('tendered')}</span>
            <span>
              {sale.cash.usd ? f.money(sale.cash.usd) : ''}
              {sale.cash.usd && sale.cash.khr ? ' + ' : ''}
              {sale.cash.khr ? f.riel(sale.cash.khr) : ''}
            </span>
          </div>
        )}
        {refunded > 0 && (
          <>
            <hr />
            <div>
              <span>{t('refunded')}</span>
              <span>−{f.money(refunded)}</span>
            </div>
          </>
        )}
        {vat > 0 && (
          <div>
            <span>{t('vatIncluded', { pct: Number(policy.taxPct) })}</span>
            <span>{f.money(vat)}</span>
          </div>
        )}
        {policy.taxId && (
          <div>
            <span>{t('vatTin', { tin: policy.taxId })}</span>
          </div>
        )}
        <hr />
        <div>
          <span style={{ whiteSpace: 'pre-line' }}>{policy.receiptFooter || t('warranty')}</span>
        </div>
      </div>
      {sale.number && (
        <ShareReceipt
          number={sale.number}
          businessId={db.shop.id}
          shopName={db.shop.name}
          btn={cx(s.btn, s.btnGhost, s.btnSm)}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {fresh ? (
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary)}
            onClick={() => {
              ui.close();
              requestAnimationFrame(focusPosSearch);
            }}
          >
            {t('newSale')}
          </button>
        ) : (
          <button
            type="button"
            className={cx(s.btn, s.btnGhost, s.dangerText)}
            disabled={refunded >= sale.total - 0.004}
            onClick={() => ui.open({ kind: 'posRefund', saleId: sale.id })}
          >
            {t('refund')}
          </button>
        )}
      </div>
    </Modal>
  );
}

export function RefundDialog({ saleId }: { saleId: string }) {
  const t = useTranslations('seller.pos.refund');
  const tm = useMethodName();
  const db = useDb();
  const f = useFmt();
  const sale = db.pos.sales.find((x) => x.id === saleId);
  const [q, setQ] = useState<number[]>(() => sale?.lines.map(() => 0) ?? []);
  const [back, setBack] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>(() => {
    const m = sale?.payments[0]?.method;
    return m === 'KHQR' || m === 'CARD' ? m : 'CASH';
  });
  if (!sale) return null;
  const done: Record<string, number> = {};
  sale.refunds.forEach((r) =>
    r.lines.forEach((l) => (done[l.variantId] = (done[l.variantId] ?? 0) + l.qty)),
  );
  const disc = sale.subtotal ? sale.discount / sale.subtotal : 0;
  const amt = round2(
    q.reduce((x, n, i) => x + n * (sale.lines[i]?.unitPrice ?? 0) * (1 - disc), 0),
  );
  const left = (i: number) =>
    (sale.lines[i]?.qty ?? 0) - (done[sale.lines[i]?.variantId ?? ''] ?? 0);

  const go = async () => {
    const ui = useUi.getState();
    const st = useSellerStore.getState();
    if (method === 'CASH' && amt > shiftCash(st.db!.pos)) {
      ui.showToast(t('noCash'));
      return;
    }
    const lines = sale.lines
      .map((l, i) => ({ variantId: l.variantId, qty: q[i] ?? 0 }))
      .filter((l) => l.qty);
    if (!(await st.refundSale(sale.id, lines, amt, method, back))) return;
    ui.close(true);
    ui.showToast(
      back
        ? t('doneBack', { amount: f.money(amt), m: tm(method) })
        : t('done', { amount: f.money(amt), m: tm(method) }),
    );
  };

  return (
    <Modal>
      <h2>{t('title', { no: sale.number })}</h2>
      <p className={cx(s.muted, s.small)}>{t('hint')}</p>
      <div>
        {sale.lines.map((l, i) => (
          <div key={i} className={s.pl}>
            <span style={{ minWidth: 0 }}>
              <span className={s.plN}>{l.title}</span>
              <span className={cx(s.tiny, s.muted)}>
                {l.variantName} · {f.money(l.unitPrice)} · {t('refundable', { n: left(i) })}
              </span>
            </span>
            <span className={s.qadj}>
              <button
                type="button"
                aria-label={t('fewer')}
                onClick={() => setQ((x) => x.map((y, j) => (j === i ? Math.max(0, y - 1) : y)))}
              >
                <Ic name="minus" size={14} />
              </button>
              <span>{q[i]}</span>
              <button
                type="button"
                aria-label={t('more')}
                onClick={() =>
                  setQ((x) => x.map((y, j) => (j === i ? Math.min(left(i), y + 1) : y)))
                }
              >
                <Ic name="plus" size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <label className={s.swr}>
        <span>
          <strong>{t('back')}</strong>
          <span className={s.hint}>{t('backHint')}</span>
        </span>
        <span className={s.sw}>
          <input type="checkbox" checked={back} onChange={(e) => setBack(e.target.checked)} />
          <span />
        </span>
      </label>
      <div className={s.field}>
        <label htmlFor="rf-m">{t('by')}</label>
        <select
          id="rf-m"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        >
          <option value="CASH">{tm('CASH')}</option>
          <option value="KHQR">{tm('KHQR')}</option>
          <option value="CARD">{tm('CARD')}</option>
        </select>
      </div>
      <button
        type="button"
        className={cx(s.btn, s.btnDanger, s.btnBlock)}
        disabled={!amt}
        onClick={go}
      >
        {t('go', { amount: f.money(amt) })}
      </button>
    </Modal>
  );
}

/**
 * Receipts (docs/api/phase16-shop-lists.md): a day at a time from the API, or a search by receipt
 * number or customer over all of them, so an older sale can be reprinted, shared or refunded.
 */
export function ReceiptsDialog() {
  const t = useTranslations('seller.pos.receipts');
  const th = useTranslations('salesHistory');
  const tm = useMethodName();
  const db = useDb();
  const f = useFmt();
  const [day, setDay] = useState(() => ppDay(new Date()));
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const query = new URLSearchParams({
    ...(q.trim() ? { q: q.trim() } : { from: day, to: day }),
    page: String(page),
    size: '20',
  }).toString();
  const { data, error, refetch } = useQuery({
    queryKey: ['seller', 'receipts', db.shop.id, query],
    queryFn: () => fetchReceiptHistory(db.shop.id, query),
    placeholderData: keepPreviousData,
  });
  const open = (sl: SellerPosSale) => {
    useSellerStore.getState().rememberSales([sl]);
    useUi.getState().open({ kind: 'posReceipt', saleId: sl.id, fresh: false });
  };
  return (
    <Modal>
      <h2>{t('title')}</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div className={s.field} style={{ flex: '1 1 180px' }}>
          <input
            type="search"
            value={q}
            placeholder={th('searchPh')}
            aria-label={th('searchLabel')}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className={s.field}>
          <DateRangePicker
            mode="single"
            variant="field"
            label={t('day')}
            from={day}
            to={day}
            clearable={false}
            max={ppDay(new Date())}
            disabled={!!q.trim()}
            onChange={(d) => {
              setDay(d);
              setPage(0);
            }}
          />
        </div>
      </div>
      {error && !data ? (
        <ErrorView error={error} retry={() => void refetch()} size="panel" />
      ) : !data ? (
        <div className={s.empty} aria-busy="true" />
      ) : data.items.length ? (
        <div>
          {data.items.map((sl) => (
            <button
              key={sl.id}
              type="button"
              className={s.row}
              style={{ gridTemplateColumns: 'auto 1fr auto', padding: '10px 0' }}
              onClick={() => open(sl)}
            >
              <span className={cx(s.num, s.small)}>{q.trim() ? f.fmtDT(sl.at) : f.hm(sl.at)}</span>
              <span className={cx(s.small, s.ellipsis)} style={{ minWidth: 0 }}>
                {sl.number} · {sl.lines.map((l) => l.title).join(', ')}
                <span className={cx(s.tiny, s.muted, s.block)}>
                  {sl.payments.map((p) => tm(p.method)).join(' + ')}
                  {sl.refunds.length ? ` · ${t('refunded')}` : ''}
                </span>
              </span>
              <b className={s.num}>{f.money(saleNet(sl))}</b>
            </button>
          ))}
          <Pagination page={page} size={20} total={data.total} onPage={setPage} />
        </div>
      ) : (
        <div className={s.empty}>
          <strong>{q.trim() ? th('noMatch') : t('none')}</strong>
        </div>
      )}
    </Modal>
  );
}

export function HeldDialog() {
  const t = useTranslations('seller.pos.heldDlg');
  const db = useDb();
  const f = useFmt();
  return (
    <Modal>
      <h2>{t('title')}</h2>
      {db.pos.held.map((h, i) => (
        <button
          key={i}
          type="button"
          className={s.row}
          style={{ gridTemplateColumns: 'auto 1fr auto', padding: '10px 0' }}
          onClick={() => {
            useSellerStore.getState().resumeSale(i);
            useUi.getState().close(true);
          }}
        >
          <span className={cx(s.num, s.small)}>{f.hm(h.at)}</span>
          <span className={s.small}>
            {t('line', { who: h.cust || t('walkIn'), n: h.cart.reduce((x, l) => x + l.qty, 0) })}
            <span className={cx(s.tiny, s.muted, s.block)}>
              {h.cart.map((l) => l.title).join(', ')}
            </span>
          </span>
          <b className={s.num}>{f.money(h.cart.reduce((x, l) => x + l.unitPrice * l.qty, 0))}</b>
        </button>
      ))}
    </Modal>
  );
}

export function VariantPickDialog({ productId }: { productId: string }) {
  const t = useTranslations('seller.pos');
  const db = useDb();
  const f = useFmt();
  const act = usePosActions();
  const p = db.products.find((x) => x.id === productId);
  if (!p) return null;
  return (
    <Modal>
      <h2>{p.title}</h2>
      <div
        className={s.optg}
        style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}
      >
        {p.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={s.vpick}
            disabled={!v.stock}
            onClick={() => {
              useUi.getState().close(true);
              void act.add(p, v);
            }}
          >
            <b>{Object.values(v.options).join(' / ')}</b>
            <span className={s.num}>{f.money(v.price)}</span>
            <span
              className={cx(
                s.tiny,
                v.stock ? (v.stock <= p.lowStockAt ? s.warnT : s.muted) : s.badT,
              )}
            >
              {v.stock ? t('inStock', { n: v.stock }) : t('soldOut')}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function CloseShiftDialog() {
  const t = useTranslations('seller.pos.close');
  const tm = useMethodName();
  const db = useDb();
  const f = useFmt();
  const [u, setU] = useState('');
  const [k, setK] = useState('');
  const sh = db.pos.shift;
  if (!sh) return null;
  const ss = db.pos.sales.filter((x) => ms(x.at) >= ms(sh.openedAt));
  const by = (m: PaymentMethod) =>
    round2(
      ss.reduce(
        (x, sl) => x + sl.payments.filter((p) => p.method === m).reduce((y, p) => y + p.amount, 0),
        0,
      ),
    );
  const exp = shiftCash(db.pos);
  const ref = round2(ss.reduce((x, sl) => x + sl.refunds.reduce((y, r) => y + r.amount, 0), 0));
  const moves = sh.moves.reduce((x, m) => x + m.amount, 0);
  const any = u !== '' || k !== '';
  const counted = (parseFloat(u) || 0) + (parseInt(k.replace(/\D/g, ''), 10) || 0) / khrRate();
  const d = round2(counted - exp);

  return (
    <Modal>
      <h2>{t('title')}</h2>
      <div className={s.sum}>
        <div>
          <span className={s.muted}>{t('opened')}</span>
          <span>
            {f.hm(sh.openedAt)} · {sh.openedByName}
          </span>
        </div>
        <div>
          <span className={s.muted}>{t('sales')}</span>
          <span>{ss.length}</span>
        </div>
        {(['CASH', 'KHQR', 'CARD'] as PaymentMethod[]).map((m) => (
          <div key={m}>
            <span className={s.muted}>{tm(m)}</span>
            <span>{f.money(by(m))}</span>
          </div>
        ))}
        {ref > 0 && (
          <div>
            <span className={s.muted}>{t('refunds')}</span>
            <span className={s.down}>−{f.money(ref)}</span>
          </div>
        )}
        <div>
          <span className={s.muted}>{t('starting')}</span>
          <span>{f.money(shiftFloat(sh))}</span>
        </div>
        {moves !== 0 && (
          <div>
            <span className={s.muted}>{t('moves')}</span>
            <span>
              {moves > 0 ? '+' : ''}
              {f.money(moves)}
            </span>
          </div>
        )}
        <div className={s.tot}>
          <span>{t('expected')}</span>
          <span>{f.money(exp)}</span>
        </div>
      </div>
      <div className={s.g2}>
        <div className={s.field}>
          <label htmlFor="cs-u">{t('countedUsd')}</label>
          <div className={s.prefix}>
            <span>$</span>
            <input
              id="cs-u"
              inputMode="decimal"
              placeholder="0"
              value={u}
              onChange={(e) => setU(e.target.value)}
            />
          </div>
        </div>
        <div className={s.field}>
          <label htmlFor="cs-k">{t('countedKhr')}</label>
          <input
            id="cs-k"
            inputMode="numeric"
            placeholder="0"
            value={k}
            onChange={(e) => setK(e.target.value)}
          />
        </div>
      </div>
      <div>
        {any &&
          (Math.abs(d) < 0.25 ? (
            <div className={s.okbox}>{t('balances', { amount: f.money(counted) })}</div>
          ) : (
            <div className={d < 0 ? s.warnbox : s.infobox}>
              {t.rich(d < 0 ? 'short' : 'over', {
                diff: f.money(Math.abs(d)),
                counted: f.money(counted),
                expected: f.money(exp),
                b: (x) => <b className={s.num}>{x}</b>,
              })}
            </div>
          ))}
      </div>
      <button
        type="button"
        className={cx(s.btn, s.btnPrimary, s.btnBlock, s.btnLg)}
        disabled={!any}
        onClick={async () => {
          if (!(await useSellerStore.getState().closeShift(round2(counted), d))) return;
          const ui = useUi.getState();
          ui.close(true);
          ui.showToast(
            Math.abs(d) >= 0.25
              ? t(d < 0 ? 'closedShort' : 'closedOver', { amount: f.money(Math.abs(d)) })
              : t('closedBalanced'),
          );
        }}
      >
        {t('submit')}
      </button>
    </Modal>
  );
}
