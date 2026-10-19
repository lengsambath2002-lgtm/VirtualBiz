'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  cx,
  findCode,
  findVariant,
  Ic,
  Modal,
  s,
  Thumb,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  vname,
  type AdjustReason,
} from '@/features/seller-shared';
import type { StockReason } from '@/lib/domain';
import { Link } from '@/lib/i18n/navigation';

const REASON: Record<AdjustReason, StockReason> = {
  recv: 'RECEIVED',
  count: 'COUNT_CORRECTION',
  dmg: 'DAMAGED_LOST',
  ret: 'CUSTOMER_RETURN',
};

/** Scan hit card (or "not found" box) for a barcode / SKU. */
export function ScanResult({ code }: { code: string }) {
  const t = useTranslations('seller.inventory');
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  if (!code) return null;
  const [p, v] = findCode(db.products, code);
  if (!p || !v)
    return (
      <div className={s.warnbox}>
        <Ic name="alert" size={14} /> {t('scanNone', { code })}{' '}
        <Link className={s.link} href="/seller/products/new" style={{ color: 'inherit' }}>
          {t('addAsNew')}
        </Link>
      </div>
    );
  return (
    <div className={s.hitCard}>
      <Thumb p={p} size={56} />
      <div>
        <strong>{p.title}</strong>
        <div className={s.small}>
          {vname(v) || tc('default')} · {t('skuLabel', { sku: v.sku })} ·{' '}
          {t.rich('inStockB', { n: v.stock, b: (x) => <b className={s.num}>{x}</b> })} ·{' '}
          {f.money(v.price)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          onClick={() => useSellerStore.getState().quickAdjust(v.id, 1)}
        >
          +1
        </button>
        <button
          type="button"
          className={cx(s.btn, s.btnPrimary, s.btnSm)}
          onClick={() => useUi.getState().open({ kind: 'adjust', variantId: v.id })}
        >
          {t('receiveAdjust')}
        </button>
        <Link className={cx(s.btn, s.btnGhost, s.btnSm)} href={`/seller/products/${p.id}`}>
          {t('open')}
        </Link>
      </div>
    </div>
  );
}

export function AdjustDialog({ variantId, preset }: { variantId: string; preset?: AdjustReason }) {
  const t = useTranslations('seller.inventory.adjust');
  const tc = useTranslations('seller.common');
  const db = useDb();
  const [p, v] = findVariant(db.products, variantId);
  const [k, setK] = useState<AdjustReason>(preset ?? 'recv');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  if (!p || !v) return null;
  const n = parseInt(qty, 10) || 0;
  const nv = k === 'count' ? n : k === 'dmg' ? v.stock - n : v.stock + n;
  const diff = nv - v.stock;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const msg =
      qty === ''
        ? t('errQty')
        : nv < 0
          ? t('errOnly', { n: v.stock })
          : k !== 'count' && n === 0
            ? t('errZero')
            : '';
    setErr(msg);
    if (msg) return;
    const ui = useUi.getState();
    if (!diff) {
      ui.close(true);
      ui.showToast(t('noChange'));
      return;
    }
    const id = useSellerStore.getState().adjustStock(v.id, diff, REASON[k], note.trim());
    ui.close(true);
    ui.showToast(t('done', { item: p.title + (vname(v) ? ` · ${vname(v)}` : ''), n: nv }), {
      label: tc('undo'),
      fn: () => {
        if (id) void useSellerStore.getState().revertMovement(id);
      },
    });
  };

  return (
    <Modal>
      <h2>{t('title')}</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Thumb p={p} />
        <div>
          <strong style={{ fontWeight: 500 }}>{p.title}</strong>
          <div className={cx(s.small, s.muted)}>
            {vname(v) || tc('default')} ·{' '}
            {t.rich('now', { n: v.stock, b: (x) => <b className={s.num}>{x}</b> })}
          </div>
        </div>
      </div>
      <form className={s.form} noValidate onSubmit={submit}>
        <div className={s.field}>
          <span className={s.lbl}>{t('reason')}</span>
          <div className={s.optg}>
            {(Object.keys(REASON) as AdjustReason[]).map((r) => (
              <label key={r} className={s.opt}>
                <input type="radio" name="rs" checked={k === r} onChange={() => setK(r)} />
                {t(`r.${r}`)}
              </label>
            ))}
          </div>
        </div>
        <div className={s.g2}>
          <div className={cx(s.field, err && s.bad)}>
            <label htmlFor="adj-q">{t(`q.${k}`)}</label>
            <input
              id="adj-q"
              inputMode="numeric"
              placeholder="0"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setErr('');
              }}
            />
            <div className={s.err}>{err}</div>
          </div>
          <div className={s.field}>
            <label htmlFor="adj-n">{t('note')}</label>
            <input
              id="adj-n"
              placeholder={t('notePh')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className={s.infobox}>
          {t.rich('preview', { n: nv, b: (x) => <b className={s.num}>{x}</b> })}
          {qty !== '' || diff ? (
            <span className={s.muted}>
              {' '}
              ({diff >= 0 ? '+' : ''}
              {diff})
            </span>
          ) : null}
        </div>
        <button type="submit" className={cx(s.btn, s.btnPrimary, s.btnBlock)}>
          {t('save')}
        </button>
      </form>
    </Modal>
  );
}

export function ReceiveDialog() {
  const t = useTranslations('seller.inventory.receiveDlg');
  const db = useDb();
  const [code, setCode] = useState('');
  const [shown, setShown] = useState('');
  return (
    <Modal>
      <h2>{t('title')}</h2>
      <p className={cx(s.muted, s.small)}>{t('hint')}</p>
      <div className={s.scanbox}>
        <Ic name="scan" size={22} />
        <input
          value={code}
          placeholder={t('scanPh')}
          autoComplete="off"
          aria-label={t('scanLabel')}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const [, v] = findCode(db.products, code);
            if (v) useUi.getState().open({ kind: 'adjust', variantId: v.id, preset: 'recv' });
            else setShown(code);
          }}
        />
      </div>
      <div>{shown && <ScanResult code={shown} />}</div>
      <div className={s.field}>
        <label htmlFor="rcv-p">{t('orChoose')}</label>
        <select
          id="rcv-p"
          defaultValue=""
          onChange={(e) =>
            e.target.value &&
            useUi.getState().open({ kind: 'adjust', variantId: e.target.value, preset: 'recv' })
          }
        >
          <option value="">{t('choose')}</option>
          {db.products.flatMap((p) =>
            p.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {p.title}
                {vname(v) ? ` · ${vname(v)}` : ''} ({v.stock})
              </option>
            )),
          )}
        </select>
      </div>
    </Modal>
  );
}

/** Top-bar Scan: USB/Bluetooth scanner or typed code → product card. */
export function ScanDialog() {
  const t = useTranslations('seller.inventory.scan');
  const db = useDb();
  const [code, setCode] = useState('');
  const [shown, setShown] = useState('');
  const sample = db.products.find((p) => p.slug === 'nita-cable')?.variants[0]?.barcode;
  return (
    <Modal>
      <h2>{t('title')}</h2>
      <p className={cx(s.muted, s.small)}>{t('hint')}</p>
      <div className={s.scanbox}>
        <Ic name="scan" size={22} />
        <input
          value={code}
          placeholder={t('ph')}
          autoComplete="off"
          aria-label={t('label')}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            setShown(code);
            e.currentTarget.select();
          }}
        />
      </div>
      <div>{shown && <ScanResult code={shown} />}</div>
      {sample && (
        <p className={cx(s.tiny, s.muted)}>
          {t.rich('try', {
            code: sample,
            btn: (x) => (
              <button
                type="button"
                className={cx(s.link, s.quiet, s.tiny)}
                onClick={() => {
                  setCode(sample);
                  setShown(sample);
                }}
              >
                {x}
              </button>
            ),
          })}
        </p>
      )}
    </Modal>
  );
}
