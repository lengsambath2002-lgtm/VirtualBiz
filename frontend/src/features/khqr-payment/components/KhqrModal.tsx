'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';

import { fallbackErrorKey, isApiError, type PaymentIntent } from '@/lib/api';
import { formatUsd, formatUsdAsKhr } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

import { getPayment, simulatePayment } from '@/features/shop-checkout/queries';
import { Modal, Spin } from '@/features/shop-shared/components/ui';
import s from '@/features/shop-shared/shop.module.css';

/** How often the sheet asks the API whether the transfer arrived (the live stream is faster). */
const POLL_MS = 3000;

export const paymentKey = (id: string) => ['payment', id] as const;

/** The KHQR string as an SVG path of its dark modules (error correction M, like bank apps). */
function useQrPath(text: string) {
  return useMemo(() => {
    if (!text) return null;
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
}

export interface KhqrModalProps {
  /** The pending KHQR session of the checkout (null = closed). */
  intent: PaymentIntent | null;
  /** The customer closes the sheet (the caller cancels the session). */
  onClose: () => void;
  /** The bank confirmed the transfer. */
  onPaid: (intent: PaymentIntent) => void;
}

/**
 * "Scan to pay" sheet: the real KHQR of the checkout and its countdown. The API learns about
 * the transfer from Bakong (needs the merchant's credentials); until then **Simulate payment**
 * is the local simulator standing in for the bank.
 */
export function KhqrModal({ intent, onClose, onPaid }: KhqrModalProps) {
  const t = useTranslations('shop.khqr');
  const tc = useTranslations('common');
  const open = !!intent;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const paidOnce = useRef(false);

  const live = useQuery({
    queryKey: paymentKey(intent?.id ?? ''),
    queryFn: () => getPayment(intent!.id),
    enabled: open,
    initialData: intent ?? undefined,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? POLL_MS : false),
  }).data;
  const current = live ?? intent;
  const path = useQrPath(current?.khqr ?? '');

  useEffect(() => {
    if (!open) return;
    paidOnce.current = false;
    setBusy(false);
    setErr('');
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, intent?.id]);

  useEffect(() => {
    if (current?.status === 'PAID' && !paidOnce.current) {
      paidOnce.current = true;
      onPaid(current);
    }
  }, [current, onPaid]);

  const expiresAt = current?.expiresAt ? Date.parse(current.expiresAt) : 0;
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));
  const expired = current?.status === 'EXPIRED' || current?.status === 'CANCELLED' || left <= 0;
  const amount = current?.amount ?? 0;

  const pay = async () => {
    if (!current) return;
    setBusy(true);
    setErr('');
    try {
      const paid = await simulatePayment(current.id);
      if (paid.status === 'PAID' && !paidOnce.current) {
        paidOnce.current = true;
        onPaid(paid);
      }
    } catch (e) {
      setBusy(false);
      setErr(isApiError(e, 'PAYMENT_EXPIRED') ? t('expired') : tc(fallbackErrorKey(e)));
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14, textAlign: 'center' }}>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>
          {t('title', { amount: formatUsd(amount) })}
        </h2>
        <p className={cn(s.muted, s.small)}>{t('body', { khr: formatUsdAsKhr(amount) })}</p>
        <div
          className={s.qr}
          style={{ display: 'block', opacity: expired ? 0.35 : 1 }}
          role="img"
          aria-label={t('qrLabel')}
          data-khqr={current?.khqr ?? ''}
        >
          {path && (
            <svg
              viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`}
              width="100%"
              height="100%"
              shapeRendering="crispEdges"
            >
              <rect x={-2} y={-2} width={path.n + 4} height={path.n + 4} fill="#fff" />
              <path d={path.d} fill="#141A2B" />
            </svg>
          )}
        </div>
        <p className={s.small} aria-live="polite">
          {expired ? (
            t('expired')
          ) : (
            <>
              {t('waiting')}{' '}
              <span className="num">
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </span>
            </>
          )}
        </p>
        <div className={s.err} role={err ? 'alert' : undefined}>
          {err}
        </div>
        <div className={s.btnPair}>
          <button className={cn(s.btn, s.btnGhost)} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className={cn(s.btn, s.btnPrimary)}
            disabled={expired || busy}
            onClick={() => void pay()}
          >
            {busy ? (
              <>
                <Spin />
                {t('confirming')}
              </>
            ) : (
              t('simulate')
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
