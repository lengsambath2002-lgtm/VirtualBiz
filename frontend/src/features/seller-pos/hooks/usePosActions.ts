'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import {
  findCode,
  stockOf,
  useSellerStore,
  useUi,
  vname,
  type SellerProduct,
} from '@/features/seller-shared';
import type { Variant } from '@/lib/domain';
import { formatUsd } from '@/lib/money';
import { formatPhone } from '@/lib/utils/phone';

export const focusPosSearch = () => document.getElementById('posq')?.focus({ preventScroll: true });

/** Register actions (prototype `posAdd`, `posPick`, `posScan`, `posAction`). */
export function usePosActions() {
  const t = useTranslations('seller.pos');
  const tc = useTranslations('seller.common');
  return useMemo(() => {
    const st = () => useSellerStore.getState();
    const ui = () => useUi.getState();
    const pos = () => st().db!.pos;
    const label = (p: SellerProduct, v: Variant) => p.title + (vname(v) ? ` · ${vname(v)}` : '');

    const add = async (p: SellerProduct, v: Variant, qty = 1) => {
      if (!pos().shift) {
        ui().open({ kind: 'posOpen' });
        return;
      }
      const inCart = pos()
        .cart.filter((l) => l.variantId === v.id)
        .reduce((x, l) => x + l.qty, 0);
      // The API never sells more than the counted stock (adjust it in Inventory first).
      if (inCart + qty > v.stock) {
        ui().showToast(t('only', { n: Math.max(0, v.stock - inCart) }));
        return;
      }
      st().addToCart(p.id, v.id, qty);
      requestAnimationFrame(focusPosSearch);
    };

    const pick = (p: SellerProduct) => {
      const only = p.variants.length === 1 ? p.variants[0] : undefined;
      if (only) return void add(p, only);
      ui().open({ kind: 'posVariant', productId: p.id });
    };

    const scan = (code: string) => {
      const [p, v] = findCode(st().db!.products, code);
      if (!p || !v) return false;
      void add(p, v);
      ui().showToast(t('added', { item: label(p, v) }));
      return true;
    };

    const tile = (p: SellerProduct) => {
      if (!stockOf(p)) {
        ui().showToast(t('soldOutToast', { title: p.title }));
        return;
      }
      pick(p);
    };

    const inc = (index: number) => {
      const l = pos().cart[index];
      if (!l) return;
      const p = st().db!.products.find((x) => x.id === l.productId);
      const v = p?.variants.find((x) => x.id === l.variantId);
      if (p && v) void add(p, v);
    };

    const clear = () => {
      const prev = st().clearSale();
      ui().showToast(t('cleared'), { label: tc('undo'), fn: () => st().restoreCart(prev) });
    };

    const discount = async () => {
      const d = pos().disc;
      const reasons = ['loyal', 'bundle', 'damaged', 'staff'] as const;
      const r = await ui().confirm({
        title: t('disc.title'),
        ok: t('disc.apply'),
        fields: [
          [
            {
              type: 'input',
              key: 'v',
              label: t('disc.amount'),
              inputMode: 'decimal',
              value: d ? String(d.v) : '',
              placeholder: '10',
            },
            {
              type: 'select',
              key: 't',
              label: t('disc.type'),
              options: [
                { value: '%', label: t('disc.pctOff') },
                { value: '$', label: t('disc.usdOff') },
              ],
              value: d?.type ?? '%',
            },
          ],
          {
            type: 'select',
            key: 'r',
            label: t('disc.reason'),
            options: reasons.map((k) => ({ value: k, label: t(`disc.reasons.${k}`) })),
          },
        ],
      });
      if (!r) return;
      const n = parseFloat(String(r.v));
      const type = r.t === '$' ? '$' : '%';
      st().setDiscount(
        n > 0 ? { type, v: type === '%' ? Math.min(100, n) : n, reason: String(r.r) } : null,
      );
    };

    const customer = async () => {
      const db = st().db!;
      const r = await ui().confirm({
        title: t('cust.title'),
        body: t('cust.body'),
        ok: t('cust.save'),
        fields: [
          {
            type: 'input',
            key: 'c',
            label: t('cust.label'),
            value: db.pos.cust,
            placeholder: '012 345 678',
            list: db.customers.map((c) => ({ value: c.name, label: formatPhone(c.phone) })),
          },
        ],
      });
      if (r) st().setCustomer(String(r.c).trim());
    };

    const hold = () => {
      st().holdSale();
      ui().showToast(t('held'));
    };

    const cashInOut = async () => {
      const r = await ui().confirm({
        title: t('cash.title'),
        ok: t('cash.record'),
        fields: [
          [
            {
              type: 'select',
              key: 'd',
              label: t('cash.direction'),
              options: [
                { value: '-1', label: t('cash.out') },
                { value: '1', label: t('cash.in') },
              ],
            },
            {
              type: 'input',
              key: 'a',
              label: t('cash.amount'),
              inputMode: 'decimal',
              placeholder: '0',
            },
          ],
          { type: 'input', key: 'r', label: t('cash.reason'), placeholder: t('cash.reasonPh') },
        ],
      });
      const a = parseFloat(String(r?.a ?? ''));
      if (!r || !(a > 0)) return;
      const amt = Number(r.d) * +a.toFixed(2);
      if (!(await st().cashMove(amt, String(r.r)))) {
        ui().showToast(t('cash.notEnough'));
        return;
      }
      ui().showToast(
        amt < 0
          ? t('cash.tookOut', { amount: formatUsd(Math.abs(amt)) })
          : t('cash.putIn', { amount: formatUsd(Math.abs(amt)) }),
      );
    };

    return { add, pick, scan, tile, inc, clear, discount, customer, hold, cashInOut };
  }, [t, tc]);
}
