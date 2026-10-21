'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  cx,
  findCode,
  findVariant,
  Ic,
  Modal,
  orderAddr,
  orderCustomer,
  payLabel,
  s,
  Thumb,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  vname,
  useMethodName,
} from '@/features/seller-shared';
import { deliveryFee } from '@/lib/pricing';
import { formatPhone } from '@/lib/utils/phone';

import { useOrderActions } from '../hooks/useOrderActions';
import { copyText } from './OrderDrawer';

/** Pack checklist: tick each unit or scan its barcode; wrong items are caught here. */
export function PackDialog({ id }: { id: string }) {
  const t = useTranslations('seller.orders.packing');
  const tc = useTranslations('seller.common');
  const db = useDb();
  const o = db.orders.find((x) => x.id === id);
  const [checked, setChecked] = useState<boolean[]>(() =>
    o ? o.lines.flatMap((l) => Array.from({ length: l.qty }, () => false)) : [],
  );
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const act = useOrderActions();
  if (!o) return null;
  const units = o.lines.flatMap((l) => Array.from({ length: l.qty }, () => l));
  const done = checked.filter(Boolean).length;

  const onScan = () => {
    const c = code.trim();
    setCode('');
    const i = units.findIndex((u, k) => {
      const [, v] = findVariant(db.products, u.variantId);
      return !checked[k] && v?.barcode === c;
    });
    if (i >= 0) {
      setChecked((x) => x.map((y, k) => (k === i ? true : y)));
      setErr('');
      return;
    }
    const [p2, v2] = findCode(db.products, c);
    setErr(
      p2 && v2
        ? t('notInOrder', { title: p2.title + (vname(v2) ? ` (${vname(v2)})` : '') })
        : t('noBarcode', { code: c }),
    );
  };

  return (
    <Modal wide>
      <h2>{t('title', { no: o.number })}</h2>
      <p className={cx(s.muted, s.small)}>{t('hint')}</p>
      <div className={s.scanbox}>
        <Ic name="scan" size={22} />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onScan();
            }
          }}
          placeholder={t('scanPh')}
          autoComplete="off"
          aria-label={t('scanLabel')}
        />
      </div>
      <div className={s.err}>{err}</div>
      <div>
        {units.map((u, n) => {
          const [p, v] = findVariant(db.products, u.variantId);
          return (
            <label key={n} className={s.pick}>
              <input
                type="checkbox"
                checked={!!checked[n]}
                onChange={(e) =>
                  setChecked((x) => x.map((y, k) => (k === n ? e.target.checked : y)))
                }
              />
              <span>
                <Thumb p={p} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span className={cx(s.pn, s.block)} style={{ fontWeight: 500 }}>
                  {u.title}
                </span>
                <span className={cx(s.tiny, s.muted)}>
                  {u.variantName || tc('default')} · <span className={s.num}>{v?.barcode}</span>
                </span>
              </span>
              <span className={cx(s.tiny, s.muted)}>
                {n + 1}/{units.length}
              </span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className={cx(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
        disabled={done < units.length || busy}
        onClick={() => {
          setBusy(true);
          void act
            .run(() => useSellerStore.getState().packOrder(o.id))
            .then((packed) => {
              setBusy(false);
              useUi.getState().close(true);
              if (packed)
                useUi
                  .getState()
                  .showToast(
                    t(o.method === 'PICKUP' ? 'packedPickup' : 'packedDelivery', { no: o.number }),
                  );
            });
        }}
      >
        {busy && <span className={s.spin} />}
        {t('markPacked', { done, n: units.length })}
      </button>
    </Modal>
  );
}

/** Hand a delivery order to a VirtualBiz rider or the shop's own delivery. */
export function ShipDialog({ id }: { id: string }) {
  const t = useTranslations('seller.orders.shipping');
  const db = useDb();
  const f = useFmt();
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = useOrderActions();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  const c = orderCustomer(db, o);
  const fee =
    o.deliveryFee ||
    deliveryFee({
      settings: { zones: db.shop.zones },
      district: o.address?.district ?? c.district,
      subtotal: 0,
    });

  const go = async () => {
    setBusy(true);
    const shipped = await act.run(() => useSellerStore.getState().shipOrder(o.id, own));
    setBusy(false);
    useUi.getState().close(true);
    if (!shipped) return;
    useUi
      .getState()
      .showToast(
        own
          ? t('outForDelivery', { no: o.number })
          : t('riderOnWay', { name: shipped.rider?.name ?? '', no: o.number }),
      );
  };

  return (
    <Modal>
      <h2>{t('title', { no: o.number })}</h2>
      <div className={s.field}>
        <span className={s.lbl}>{t('who')}</span>
        <div style={{ display: 'grid', gap: 8 }}>
          <label className={s.opt}>
            <input type="radio" name="rd" checked={!own} onChange={() => setOwn(false)} />
            <span>
              <b style={{ fontWeight: 500 }}>{t('vb')}</b>
              <span className={cx(s.tiny, s.muted, s.block)}>
                {t('vbHint', {
                  fee: f.money(fee),
                  payer: o.deliveryFee ? t('payerCustomer') : t('payerYou'),
                })}
              </span>
            </span>
          </label>
          <label className={s.opt}>
            <input type="radio" name="rd" checked={own} onChange={() => setOwn(true)} />
            <span>
              <b style={{ fontWeight: 500 }}>{t('own')}</b>
              <span className={cx(s.tiny, s.muted, s.block)}>{t('ownHint')}</span>
            </span>
          </label>
        </div>
      </div>
      {payLabel(o) === 'COD' && (
        <div className={s.warnbox}>
          {t.rich('codCollect', {
            amount: f.money(o.total),
            khr: f.khr(o.total),
            b: (x) => <b className={s.num}>{x}</b>,
          })}
        </div>
      )}
      <button
        type="button"
        className={cx(s.btn, s.btnPrimary, s.btnBlock)}
        disabled={busy}
        onClick={() => void go()}
      >
        {busy ? (
          <>
            <span className={s.spin} />
            {own ? t('saving') : t('finding')}
          </>
        ) : (
          <>
            <Ic name="truck" size={18} />
            {t('request')}
          </>
        )}
      </button>
    </Modal>
  );
}

export function InvoiceDialog({ id }: { id: string }) {
  const t = useTranslations('seller.orders.invoiceDlg');
  const tp = useMethodName();
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  const c = orderCustomer(db, o);
  const email = c.email;
  const ui = useUi.getState();
  return (
    <Modal>
      <h2>{t('title', { no: o.number })}</h2>
      <div className={cx(s.receipt, s.num)}>
        <div>
          <b>{db.shop.name}</b>
          <span>{f.fmtDT(o.createdAt)}</span>
        </div>
        <div>
          <span>{db.shop.addr}</span>
        </div>
        <hr />
        <div>
          <span>{t('billTo', { name: c.name })}</span>
          <span>{formatPhone(c.phone)}</span>
        </div>
        <div>
          <span>{orderAddr(o, c)}</span>
        </div>
        <hr />
        {o.lines.map((l, i) => (
          <div key={i}>
            <span>
              {l.qty} × {l.title}
              {l.variantName ? ` (${l.variantName})` : ''}
            </span>
            <span>{f.money(l.qty * l.unitPrice)}</span>
          </div>
        ))}
        <hr />
        <div>
          <span>{t('subtotal')}</span>
          <span>{f.money(o.subtotal)}</span>
        </div>
        <div>
          <span>{t('delivery')}</span>
          <span>{f.money(o.deliveryFee)}</span>
        </div>
        <div>
          <b>{t('total')}</b>
          <b>{f.money(o.total)}</b>
        </div>
        <div>
          <span>{t('paidBy', { pay: tp(payLabel(o)) })}</span>
          <span>{f.khr(o.total)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          className={cx(s.btn, s.btnGhost)}
          onClick={() => void copyText(email, ui.showToast, tc('copied', { v: email }))}
        >
          {t('copyEmail')}
        </button>
        {/* Opens the shop's own email app with the invoice written out (no email provider needed). */}
        <a
          className={cx(s.btn, s.btnPrimary)}
          aria-disabled={!email}
          style={email ? undefined : { pointerEvents: 'none', opacity: 0.5 }}
          href={
            email
              ? `mailto:${email}?subject=${encodeURIComponent(
                  t('mailSubject', { no: o.number, shop: db.shop.name }),
                )}&body=${encodeURIComponent(
                  [
                    t('mailHello', { name: c.name }),
                    '',
                    ...o.lines.map(
                      (l) =>
                        `${l.qty} × ${l.title}${l.variantName ? ` (${l.variantName})` : ''}  ${f.money(l.qty * l.unitPrice)}`,
                    ),
                    '',
                    `${t('total')}: ${f.money(o.total)} (${f.khr(o.total)})`,
                    t('paidBy', { pay: tp(payLabel(o)) }),
                    '',
                    t('mailThanks', { shop: db.shop.name }),
                  ].join('\n'),
                )}`
              : undefined
          }
          onClick={() => ui.close(true)}
        >
          {t('email')}
        </a>
      </div>
    </Modal>
  );
}
