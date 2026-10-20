'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';

import {
  createManualOrder,
  cx,
  findCode,
  Ic,
  Modal,
  s,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  vname,
  type ManualOrderInput,
} from '@/features/seller-shared';
import { api, isApiError, type ApiDistrict } from '@/lib/api';
import { round2 } from '@/lib/money';
import { isValidPhone, normalizePhone } from '@/lib/utils/phone';

type Source = ManualOrderInput['source'];
type Pay = ManualOrderInput['payment'];
const SOURCES: Source[] = ['PHONE', 'FACEBOOK', 'TELEGRAM', 'WALK_IN', 'OTHER'];
const PAYS: Pay[] = ['COD', 'PAID_CASH', 'PAID_KHQR'];

/**
 * "New → Manual order" (docs/api/phase8-manual-orders.md): an order the shop took by phone,
 * Facebook, Telegram or at the counter. It joins the order list already accepted and takes stock
 * like any order; the customer is added to the shop's clients by phone.
 */
export function ManualOrderDialog() {
  const t = useTranslations('seller.manual');
  const tc = useTranslations('common');
  const db = useDb();
  const f = useFmt();
  const shop = db.shop;
  const { data: districts = [] } = useQuery({
    queryKey: ['meta', 'districts'],
    queryFn: () => api.get<ApiDistrict[]>('/meta/districts', { auth: false }),
    staleTime: Infinity,
  });

  const [source, setSource] = useState<Source>('PHONE');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<{ variantId: string; qty: number }[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [line, setLine] = useState('');
  const [district, setDistrict] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [fee, setFee] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [pay, setPay] = useState<Pay>('COD');
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const variants = useMemo(
    () =>
      db.products
        .filter((p) => p.status === 'ACTIVE')
        .flatMap((p) => p.variants.map((v) => ({ p, v }))),
    [db.products],
  );
  const byId = useMemo(() => new Map(variants.map((x) => [x.v.id, x])), [variants]);
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? variants
        .filter(({ p, v }) =>
          [p.title, vname(v), v.sku ?? '', v.barcode ?? '']
            .join(' ')
            .toLowerCase()
            .includes(needle),
        )
        .slice(0, 6)
    : [];

  const add = (variantId: string) => {
    setLines((ls) =>
      ls.some((l) => l.variantId === variantId)
        ? ls.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { variantId, qty: 1 }],
    );
    setQ('');
    setErrs((e) => ({ ...e, lines: '' }));
  };
  const setQty = (variantId: string, qty: number) =>
    setLines((ls) =>
      qty <= 0
        ? ls.filter((l) => l.variantId !== variantId)
        : ls.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
    );

  const subtotal = round2(
    lines.reduce((n, l) => n + (byId.get(l.variantId)?.v.price ?? 0) * l.qty, 0),
  );
  const off = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  // The shop's zone fee for the district (free over its threshold), unless staff typed one.
  const zone = shop.zones.find((z) => z.districts.includes(district)) ?? shop.zones.at(-1);
  const freeOver = shop.freeDeliveryOver > 0 && subtotal - off >= shop.freeDeliveryOver;
  const suggested = method === 'PICKUP' || !district ? 0 : freeOver ? 0 : (zone?.fee ?? 0);
  const deliveryFee =
    method === 'PICKUP' ? 0 : fee === null ? suggested : Math.max(0, Number(fee) || 0);
  const total = round2(subtotal - off + deliveryFee);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!lines.length) x.lines = t('err.lines');
    if (name.trim().length < 2) x.name = t('err.name');
    if (phone.trim() && !isValidPhone(phone)) x.phone = t('err.phone');
    if (method === 'DELIVERY') {
      if (!phone.trim()) x.phone = t('err.phoneNeeded');
      if (line.trim().length < 3) x.line = t('err.line');
      if (!district) x.district = t('err.district');
    }
    for (const l of lines) {
      const v = byId.get(l.variantId)?.v;
      if (v && l.qty > v.stock)
        x.lines = t('err.stock', { name: byId.get(l.variantId)!.p.title, n: v.stock });
    }
    setErrs(x);
    if (Object.values(x).some(Boolean)) return;
    setBusy(true);
    try {
      const o = await createManualOrder(shop.id, {
        source,
        name: name.trim(),
        ...(phone.trim() ? { phone: normalizePhone(phone) } : {}),
        method,
        ...(method === 'DELIVERY'
          ? {
              line: line.trim(),
              district,
              ...(addressNote.trim() ? { addressNote: addressNote.trim() } : {}),
            }
          : {}),
        lines,
        deliveryFee,
        ...(off > 0 ? { discount: off } : {}),
        payment: pay,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      const st = useSellerStore.getState();
      await Promise.all([st.resyncOrders(), st.resync()]);
      const ui = useUi.getState();
      ui.showToast(t('created', { no: o.number }));
      ui.open({ kind: 'order', id: o.id });
    } catch (err) {
      if (isApiError(err, 'INSUFFICIENT_STOCK')) setErrs({ lines: t('err.stockServer') });
      else if (isApiError(err, 'INVALID_PHONE')) setErrs({ phone: t('err.phone') });
      else if (isApiError(err, 'VALIDATION_FAILED') && err.details[0]?.field)
        setErrs({ [err.details[0].field.replace(/\[.*$/, '')]: t('err.check') });
      else useUi.getState().showToast(tc('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const seg = <T extends string>(
    value: T,
    options: T[],
    label: (o: T) => string,
    on: (o: T) => void,
    aria: string,
  ) => (
    <div
      className={s.seg}
      role="group"
      aria-label={aria}
      style={{ justifySelf: 'start', flexWrap: 'wrap' }}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={cx(value === o && s.on)}
          aria-pressed={value === o}
          onClick={() => on(o)}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );

  return (
    <Modal wide label={t('title')}>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
        <h2>{t('title')}</h2>
        <p className={cx(s.muted, s.small)} style={{ marginTop: -8 }}>
          {t('hint')}
        </p>

        {seg(source, SOURCES, (o) => t(`source.${o}`), setSource, t('sourceLabel'))}

        <div className={cx(s.field, errs.lines && s.bad)}>
          <label htmlFor="mo-q">{t('items')}</label>
          <div className={s.search} style={{ maxWidth: 'none' }}>
            <Ic name="search" size={18} />
            <input
              id="mo-q"
              type="search"
              // Inside a form field, whose input padding would otherwise cover the icon.
              style={{ paddingLeft: 36 }}
              value={q}
              autoComplete="off"
              placeholder={t('itemsPh')}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const [, v] = findCode(db.products, q);
                if (v) add(v.id);
                else if (hits[0]) add(hits[0].v.id);
              }}
            />
          </div>
          {hits.length > 0 && (
            <div
              className={s.menu}
              style={{ position: 'static', boxShadow: 'none', width: '100%' }}
              role="listbox"
            >
              {hits.map(({ p, v }) => (
                <button
                  key={v.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={v.stock <= 0}
                  onClick={() => add(v.id)}
                >
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    {p.title}
                    {vname(v) ? <span className={s.muted}> · {vname(v)}</span> : null}
                  </span>
                  <span className={cx(s.small, s.muted, s.num)}>
                    {f.money(v.price)} ·{' '}
                    {v.stock <= 0 ? t('soldOut') : t('inStock', { n: v.stock })}
                  </span>
                </button>
              ))}
            </div>
          )}
          {lines.length > 0 && (
            <div className={s.tblWrap}>
              <table style={{ minWidth: 0 }}>
                <tbody>
                  {lines.map((l) => {
                    const it = byId.get(l.variantId);
                    if (!it) return null;
                    return (
                      <tr key={l.variantId}>
                        <td>
                          {it.p.title}
                          {vname(it.v) && (
                            <span className={cx(s.tiny, s.muted, s.block)}>{vname(it.v)}</span>
                          )}
                          {l.qty > it.v.stock && (
                            <span className={cx(s.tiny, s.dangerText, s.block)}>
                              {t('onlyN', { n: it.v.stock })}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className={s.qadj}>
                            <button
                              type="button"
                              aria-label={t('less')}
                              onClick={() => setQty(l.variantId, l.qty - 1)}
                            >
                              <Ic name="minus" size={14} />
                            </button>
                            <span className={s.num}>{l.qty}</span>
                            <button
                              type="button"
                              aria-label={t('more')}
                              onClick={() => setQty(l.variantId, l.qty + 1)}
                            >
                              <Ic name="plus" size={14} />
                            </button>
                          </div>
                        </td>
                        <td className={cx(s.r, s.num)}>{f.money(it.v.price * l.qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className={s.err}>{errs.lines}</div>
        </div>

        <div className={s.g2}>
          <div className={cx(s.field, errs.name && s.bad)}>
            <label htmlFor="mo-name">{t('name')}</label>
            <input
              id="mo-name"
              value={name}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
            <div className={s.err}>{errs.name}</div>
          </div>
          <div className={cx(s.field, errs.phone && s.bad)}>
            <label htmlFor="mo-phone">{t('phone')}</label>
            <input
              id="mo-phone"
              inputMode="tel"
              value={phone}
              placeholder="012 345 678"
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className={s.err}>{errs.phone}</div>
          </div>
        </div>

        {seg(
          method,
          shop.pickup ? (['DELIVERY', 'PICKUP'] as const).slice() : ['DELIVERY' as const],
          (o) => t(`method.${o}`),
          setMethod,
          t('methodLabel'),
        )}

        {method === 'DELIVERY' && (
          <>
            <div className={s.g2}>
              <div className={cx(s.field, errs.line && s.bad)}>
                <label htmlFor="mo-line">{t('line')}</label>
                <input
                  id="mo-line"
                  value={line}
                  placeholder={t('linePh')}
                  onChange={(e) => setLine(e.target.value)}
                />
                <div className={s.err}>{errs.line}</div>
              </div>
              <div className={cx(s.field, errs.district && s.bad)}>
                <label htmlFor="mo-district">{t('district')}</label>
                <select
                  id="mo-district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">{t('districtPh')}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.name}>
                      {tc(`districts.${d.id}` as 'districts.toul-kork')}
                    </option>
                  ))}
                </select>
                <div className={s.err}>{errs.district}</div>
              </div>
            </div>
            <div className={s.g2}>
              <div className={s.field}>
                <label htmlFor="mo-anote">{t('addressNote')}</label>
                <input
                  id="mo-anote"
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                />
              </div>
              <div className={s.field}>
                <label htmlFor="mo-fee">{t('fee')}</label>
                <input
                  id="mo-fee"
                  inputMode="decimal"
                  value={fee ?? String(suggested)}
                  onChange={(e) => setFee(e.target.value)}
                />
                <span className={s.hint}>{freeOver ? t('feeFree') : t('feeHint')}</span>
              </div>
            </div>
          </>
        )}

        <div className={s.g2}>
          <div className={s.field}>
            <label htmlFor="mo-off">{t('discount')}</label>
            <input
              id="mo-off"
              inputMode="decimal"
              value={discount}
              placeholder="0"
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className={s.field}>
            <label htmlFor="mo-note">{t('note')}</label>
            <input
              id="mo-note"
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className={s.field}>
          <span>{t('payLabel')}</span>
          {seg(
            pay,
            PAYS,
            (o) => (o === 'COD' && method === 'PICKUP' ? t('pay.COD_PICKUP') : t(`pay.${o}`)),
            setPay,
            t('payLabel'),
          )}
        </div>

        <div className={s.sum}>
          <div>
            <span className={s.muted}>{t('subtotal')}</span>
            <span className={s.num}>{f.money(subtotal)}</span>
          </div>
          {off > 0 && (
            <div>
              <span className={s.muted}>{t('discount')}</span>
              <span className={s.num}>−{f.money(off)}</span>
            </div>
          )}
          {method === 'DELIVERY' && (
            <div>
              <span className={s.muted}>{t('fee')}</span>
              <span className={s.num}>{f.money(deliveryFee)}</span>
            </div>
          )}
          <div className={s.tot} style={{ fontSize: 16 }}>
            <span>{t('total')}</span>
            <span className={s.num}>{f.money(total)}</span>
          </div>
          <div>
            <span />
            <span className={cx(s.tiny, s.muted)}>{f.khr(total)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className={cx(s.btn, s.btnGhost)}
            onClick={() => useUi.getState().close()}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className={cx(s.btn, s.btnPrimary)}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? t('creating') : t('create', { total: f.money(total) })}
          </button>
        </div>
      </form>
    </Modal>
  );
}
