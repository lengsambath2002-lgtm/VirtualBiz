'use client';

import { useState } from 'react';

import type { PaymentMethod } from '@/lib/domain';
import { formatPhone } from '@/lib/utils/phone';

import { PIcon, type PIconName } from '@/features/provider-shared/components/Icon';
import { Field, Modal } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { createSale, fetchAppointment } from '@/features/provider-shared/api';
import { putAppointment, useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import type { ProviderSale } from '@/features/provider-shared/types';
import {
  cashChips,
  checkoutTotals,
  firstName,
  type CheckoutLine,
} from '@/features/provider-shared/util/logic';
import { fmtStamp } from '@/features/provider-shared/util/time';
import { acceptedMethods, vatIncluded } from '@/lib/shop';

const PAY: [PaymentMethod, PIconName][] = [
  ['CASH', 'cash'],
  ['KHQR', 'qr'],
  ['CARD', 'card'],
];
const INPUT = {
  height: 38,
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)',
  padding: '0 10px',
} as const;

/** Checkout for an appointment, or a quick sale (prototype `checkout`). */
export function Checkout({ id }: { id?: string }) {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const actions = useActions();
  const a = id ? d.appointments.find((x) => x.id === id) : undefined;
  const client = a ? d.clients.find((c) => c.id === a.clientId) : undefined;
  const [items, setItems] = useState<CheckoutLine[]>(() =>
    a
      ? [
          {
            title: d.services.find((s) => s.id === a.serviceId)?.name ?? '',
            price: a.price,
            staffId: a.staffId,
            serviceId: a.serviceId,
          },
        ]
      : [],
  );
  const [priceText, setPriceText] = useState<Record<number, string>>({});
  const [disc, setDisc] = useState(0);
  const [discText, setDiscText] = useState('');
  const [discType, setDiscType] = useState<'%' | '$'>('%');
  const [tipPct, setTipPct] = useState(0);
  const [tipCustom, setTipCustom] = useState<number | null>(null);
  const [tipText, setTipText] = useState('');
  // What this shop takes at the counter, and its own tip choices (settings).
  const payOptions = PAY.filter(([m]) => acceptedMethods(d.business.policy).includes(m));
  const [pay, setPay] = useState<PaymentMethod>(payOptions[0]?.[0] ?? 'CASH');
  const [given, setGiven] = useState('');
  const [saving, setSaving] = useState(false);

  const tot = checkoutTotals(items, { disc, discType, tipPct, tipCustom, pay, given });
  const tipTo = items[0]?.staffId
    ? d.staff.find((m) => m.id === items[0]!.staffId)?.name
    : undefined;

  const complete = async () => {
    setSaving(true);
    let sale: ProviderSale;
    try {
      sale = await createSale(d.business.id, {
        ...(a ? { appointmentId: a.id } : {}),
        lines: items.map((i) => ({
          title: i.title,
          qty: 1,
          unitPrice: i.price,
          ...(i.staffId ? { staffId: i.staffId } : {}),
          ...(i.serviceId ? { serviceId: i.serviceId } : {}),
          ...(i.variantId ? { variantId: i.variantId } : {}),
        })),
        discount: tot.discount,
        tip: tot.tip,
        payments: [{ method: pay, amount: tot.total }],
        ...(pay === 'CASH' && tot.change !== null
          ? { cash: { usd: +given, khr: 0, change: tot.change } }
          : {}),
      });
    } catch (e) {
      setSaving(false);
      actions.fail(e);
      return;
    }
    const store = useProviderStore.getState();
    store.update((dd) => {
      dd.sales.push(sale);
      for (const l of sale.lines) {
        if (!l.variantId) continue;
        for (const p of dd.products)
          for (const v of p.variants) if (v.id === l.variantId) v.stock -= l.qty;
      }
    });
    if (a) void fetchAppointment(d.business.id, a.id).then(putAppointment, () => {});
    ui.open({ t: 'receipt', saleId: sale.id, change: tot.change });
  };

  return (
    <Modal wide autoFocus={false}>
      <h2>{a ? t('checkout.title', { name: client?.name ?? '' }) : t('checkout.quickSale')}</h2>
      <div className={k('co')}>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div>
            {items.length ? (
              items.map((i, n) => (
                <div key={n} className={k('line')}>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{i.title}</strong>
                    {i.staffId && (
                      <span className={k('tiny muted')} style={{ display: 'block' }}>
                        {d.staff.find((m) => m.id === i.staffId)?.name}
                      </span>
                    )}
                  </span>
                  <div className={k('prefix')} style={{ width: 96 }}>
                    <span>$</span>
                    <input
                      inputMode="decimal"
                      aria-label={t('checkout.priceOf', { name: i.title })}
                      className={k('num')}
                      style={{
                        width: '100%',
                        height: 34,
                        border: '1px solid var(--line)',
                        padding: '0 8px',
                        textAlign: 'right',
                      }}
                      value={priceText[n] ?? String(i.price)}
                      onChange={(e) => setPriceText((p) => ({ ...p, [n]: e.target.value }))}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        setItems((xs) =>
                          xs.map((x, j) =>
                            j === n && v >= 0 ? { ...x, price: +v.toFixed(2) } : x,
                          ),
                        );
                        setPriceText((p) => {
                          const q = { ...p };
                          delete q[n];
                          return q;
                        });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className={k('ibtn')}
                    style={{ width: 32, height: 32 }}
                    aria-label={t('checkout.remove', { name: i.title })}
                    onClick={() => {
                      setItems((xs) => xs.filter((_, j) => j !== n));
                      setPriceText({});
                    }}
                  >
                    <PIcon name="x" size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p className={k('muted small')}>{t('checkout.empty')}</p>
            )}
          </div>
          <div className={k('g2')}>
            <select
              className={k('select')}
              aria-label={t('checkout.addServiceLabel')}
              value=""
              onChange={(e) => {
                const s = d.services.find((x) => x.id === e.target.value);
                if (s)
                  setItems((xs) => [
                    ...xs,
                    {
                      title: s.name,
                      price: s.price,
                      staffId: a ? a.staffId : s.staffIds[0],
                      serviceId: s.id,
                    },
                  ]);
              }}
            >
              <option value="">{t('checkout.addService')}</option>
              {d.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {f.money0(s.price)}
                </option>
              ))}
            </select>
            <select
              className={k('select')}
              aria-label={t('checkout.addProductLabel')}
              value=""
              onChange={(e) => {
                const p = d.products.find((x) => x.id === e.target.value);
                const v = p?.variants[0];
                if (p && v)
                  setItems((xs) => [...xs, { title: p.title, price: v.price, variantId: v.id }]);
              }}
            >
              <option value="">{t('checkout.addProduct')}</option>
              {d.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {f.money0(p.variants[0]?.price ?? 0)}
                </option>
              ))}
            </select>
          </div>
          <div className={k('field')}>
            <span className={k('lbl')}>{t('checkout.discount')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="0"
                inputMode="decimal"
                aria-label={t('checkout.discount')}
                style={{ flex: 1, ...INPUT }}
                value={discText}
                onChange={(e) => setDiscText(e.target.value)}
                onBlur={() => {
                  let v = Math.max(0, parseFloat(discText) || 0);
                  if (discType === '%') v = Math.min(100, v);
                  setDisc(v);
                  setDiscText(v ? String(v) : '');
                }}
              />
              <div className={k('seg')}>
                {(['%', '$'] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={k(discType === x && 'on')}
                    onClick={() => setDiscType(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={k('field')}>
            <span className={k('lbl')}>
              {t('checkout.tip')}{' '}
              {tipTo && (
                <span className={k('muted')} style={{ fontWeight: 400 }}>
                  {t('checkout.tipTo', { name: firstName(tipTo) })}
                </span>
              )}
            </span>
            <div className={k('chips')}>
              {d.business.tipPresets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={k('chip', tipCustom === null && tipPct === p && 'on')}
                  onClick={() => {
                    setTipPct(p);
                    setTipCustom(null);
                    setTipText('');
                  }}
                >
                  {p ? `${p}%` : t('checkout.noTip')}
                </button>
              ))}
              <input
                placeholder={t('checkout.customTip')}
                inputMode="decimal"
                aria-label={t('checkout.customTipLabel')}
                style={{
                  width: 90,
                  height: 32,
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  padding: '0 12px',
                }}
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(tipText);
                  setTipCustom(v >= 0 ? +v.toFixed(2) : null);
                  if (!(v >= 0)) setTipText('');
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className={k('sum')}>
            <div>
              <span className={k('muted')}>{t('checkout.subtotal')}</span>
              <span>{f.money(tot.sub)}</span>
            </div>
            {tot.discount > 0 && (
              <div>
                <span className={k('muted')}>{t('checkout.discount')}</span>
                <span className={k('up')}>−{f.money(tot.discount)}</span>
              </div>
            )}
            {tot.tip > 0 && (
              <div>
                <span className={k('muted')}>{t('checkout.tip')}</span>
                <span>{f.money(tot.tip)}</span>
              </div>
            )}
            <div className={k('tot')}>
              <span>{t('checkout.toPay')}</span>
              <span>{f.money(tot.total)}</span>
            </div>
            <div>
              <span className={k('tiny muted')}>≈ {f.khr(tot.total)}</span>
            </div>
          </div>
          <div className={k('paym')} role="radiogroup" aria-label={t('checkout.payMethod')}>
            {payOptions.map(([p, ic]) => (
              <label key={p}>
                <input
                  type="radio"
                  name="pay"
                  value={p}
                  checked={pay === p}
                  onChange={() => setPay(p)}
                />
                <PIcon name={ic} size={20} />
                {f.pay(p)}
              </label>
            ))}
          </div>
          {pay === 'CASH' ? (
            <Field id="given" label={t('checkout.cashReceived')}>
              <div className={k('prefix')}>
                <span>$</span>
                <input
                  id="given"
                  inputMode="decimal"
                  value={given}
                  placeholder={tot.total.toFixed(2)}
                  onChange={(e) => setGiven(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className={k('chips')}>
                {cashChips(tot.total).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={k('chip')}
                    onClick={() => setGiven(String(v))}
                  >
                    ${v}
                  </button>
                ))}
              </div>
              {tot.change !== null &&
                (tot.change < 0 ? (
                  <span className={k('err')}>
                    {t('checkout.short', { amount: f.money(-tot.change) })}
                  </span>
                ) : (
                  <div className={k('okbox')}>
                    {t.rich('checkout.change', {
                      amount: f.money(tot.change),
                      khr: f.khr(tot.change),
                      b: (c) => <b className={k('num')}>{c}</b>,
                      span: (c) => <span className={k('num')}>{c}</span>,
                    })}
                  </div>
                ))}
            </Field>
          ) : pay === 'KHQR' ? (
            <div className={k('infobox')}>
              {t.rich('checkout.khqrInfo', { b: (c) => <b>{c}</b> })}
            </div>
          ) : (
            <div className={k('infobox')}>
              {t('checkout.cardInfo', { amount: f.money(tot.total) })}
            </div>
          )}
          <button
            type="button"
            className={k('btn btn-primary btn-lg btn-block')}
            disabled={
              saving || !items.length || (pay === 'CASH' && tot.change !== null && tot.change < 0)
            }
            onClick={() => void complete()}
          >
            {saving ? (
              <>
                <span className={k('spin')} />
                {t('checkout.saving')}
              </>
            ) : (
              t('checkout.complete', { amount: f.money(tot.total) })
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Receipt (after checkout: "Sale complete" + change to give). */
export function Receipt({ saleId, change }: { saleId: string; change?: number | null }) {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const act = useActions();
  const s = d.sales.find((x) => x.id === saleId);
  if (!s) return null;
  const c = s.customerId ? d.clients.find((x) => x.id === s.customerId) : undefined;
  const after = change !== undefined;
  const method = s.payments[0]?.method ?? 'CASH';
  return (
    <Modal>
      <h2>{after ? t('receipt.complete') : t('receipt.title')}</h2>
      {after && change != null && change > 0 && (
        <div className={k('okbox')} style={{ fontSize: 15 }}>
          {t.rich('receipt.giveChange', {
            amount: f.money(change),
            b: (x) => <b className={k('num')}>{x}</b>,
          })}
        </div>
      )}
      <div className={k('receipt num')}>
        <div>
          <b>{d.business.name}</b>
          <span>#{s.number}</span>
        </div>
        {d.business.policy.receiptHeader && (
          <div>
            <span>{d.business.policy.receiptHeader}</span>
          </div>
        )}
        <div>
          <span>{fmtStamp(s.at, locale)}</span>
          <span>{c ? c.name : t('receipt.walkinSale')}</span>
        </div>
        <hr />
        {s.lines.map((l, i) => (
          <div key={i}>
            <span>
              {l.title}
              {l.staffId
                ? ` · ${firstName(d.staff.find((m) => m.id === l.staffId)?.name ?? '')}`
                : ''}
            </span>
            <span>{f.money(l.unitPrice * l.qty)}</span>
          </div>
        ))}
        <hr />
        {s.discount > 0 && (
          <div>
            <span>{t('receipt.discount')}</span>
            <span>−{f.money(s.discount)}</span>
          </div>
        )}
        {s.tip > 0 && (
          <div>
            <span>{t('receipt.tip')}</span>
            <span>{f.money(s.tip)}</span>
          </div>
        )}
        <div>
          <b>{t('receipt.total')}</b>
          <b>{f.money(s.total)}</b>
        </div>
        <div>
          <span>{t('receipt.paidBy')}</span>
          <span>{f.pay(method)}</span>
        </div>
        <div>
          <span>{t('receipt.khr')}</span>
          <span>{f.khr(s.total)}</span>
        </div>
        {vatIncluded(s.total, Number(d.business.policy.taxPct)) > 0 && (
          <div>
            <span>{t('receipt.vatIncluded', { pct: Number(d.business.policy.taxPct) })}</span>
            <span>{f.money(vatIncluded(s.total, Number(d.business.policy.taxPct)))}</span>
          </div>
        )}
        {d.business.policy.taxId && (
          <div>
            <span>{t('receipt.vatTin', { tin: d.business.policy.taxId })}</span>
          </div>
        )}
        {d.business.policy.receiptFooter && (
          <>
            <hr />
            <div>
              <span style={{ whiteSpace: 'pre-line' }}>{d.business.policy.receiptFooter}</span>
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {c ? (
          <button
            type="button"
            className={k('btn btn-ghost')}
            onClick={() => {
              ui.showToast(t('receipt.sent', { phone: formatPhone(c.phone) }));
              ui.close(true);
            }}
          >
            {t('receipt.sms')}
          </button>
        ) : (
          <span />
        )}
        {s.appointmentId ? (
          <button
            type="button"
            className={k('btn btn-primary')}
            onClick={() => act.rebook(s.appointmentId!)}
          >
            {t('receipt.bookNext')}
          </button>
        ) : (
          <button type="button" className={k('btn btn-primary')} onClick={() => ui.close()}>
            {t('receipt.done')}
          </button>
        )}
      </div>
    </Modal>
  );
}
