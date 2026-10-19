'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { fallbackErrorKey, type CheckoutInput, type Quote, type QuotePromo } from '@/lib/api';
import { cn } from '@/lib/utils/cn';

import { quote as fetchQuote } from '@/features/shop-checkout/queries';
import { Ic } from '@/features/shop-shared/components/Ic';
import { useFmt } from '@/features/shop-shared/hooks';
import s from '@/features/shop-shared/shop.module.css';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { AppliedPromo } from '@/features/shop-shared/types';
import { usePromoLabel } from '@/features/shop-shared/usePromoLabel';

/** The promo's rule as the label helper reads it. */
const ruleOf = (p: QuotePromo): AppliedPromo['rule'] => ({
  type: p.type ?? 'FIXED',
  value: p.value ?? 0,
  ...(p.minSpend != null ? { minSpend: p.minSpend } : {}),
  ...(p.maxDiscount != null ? { maxDiscount: p.maxDiscount } : {}),
});

/** Codes the server knows but cannot apply now (the field shows why). */
const REFUSED = ['UNKNOWN', 'SCHEDULED', 'ENDED', 'USED_UP', 'NOT_APPLICABLE'];

/**
 * Promo code field, or the applied code with its label (or how much more to spend). The server
 * checks the code (`POST /api/checkout/quote`); `quote` is the page's current quote.
 */
export function PromoBox({
  lines,
  district,
  quote,
}: {
  lines: CheckoutInput['lines'];
  district?: string;
  quote: Quote | undefined;
}) {
  const t = useTranslations('shop.cart');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const f = useFmt();
  const label = usePromoLabel();
  const promo = useShopStore((st) => st.promo);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const why = (p: QuotePromo, c: string) =>
    p.reason && p.reason !== 'UNKNOWN'
      ? t(`promoWhy.${p.reason}` as 'promoWhy.ENDED', { code: c })
      : t('invalidCode', { code: c });

  if (promo) {
    const p = quote?.promo;
    const refused = p && !p.applied && p.reason && REFUSED.includes(p.reason);
    return (
      <div className={s.applied}>
        <span>
          <Ic name="tag" size={14} /> <b>{promo.code}</b> ·{' '}
          {refused
            ? why(p, promo.code)
            : p && !p.applied && p.reason === 'MIN_SPEND'
              ? t('addMore', { amount: f.money(p.shortBy ?? 0) })
              : label(p ? ruleOf(p) : promo.rule)}
        </span>
        <button
          className={cn(s.link, s.quiet, s.small)}
          style={{ color: 'inherit' }}
          onClick={() => useShopStore.getState().set({ promo: null })}
        >
          {t('remove')}
        </button>
      </div>
    );
  }

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || busy) return;
    if (!lines.length) {
      setErr(t('invalidCode', { code: c }));
      return;
    }
    setBusy(true);
    try {
      const q = await fetchQuote({ lines, ...(district ? { district } : {}), promoCode: c });
      const p = q.promo;
      if (!p || (!p.applied && p.reason && REFUSED.includes(p.reason))) {
        setErr(p ? why(p, c) : t('invalidCode', { code: c }));
        return;
      }
      setErr('');
      useShopStore.getState().set({ promo: { code: p.code, rule: ruleOf(p) } });
      toast(tt('promoApplied', { code: p.code }));
    } catch (e2) {
      setErr(tc(fallbackErrorKey(e2)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className={s.promo} noValidate onSubmit={(e) => void apply(e)}>
        <input
          placeholder={t('promoPh')}
          aria-label={t('promoPh')}
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className={cn(s.btn, s.btnGhost, s.btnSm)} style={{ height: 40 }} disabled={busy}>
          {t('apply')}
        </button>
      </form>
      <div className={s.err} role={err ? 'alert' : undefined}>
        {err}
      </div>
    </>
  );
}
