'use client';

import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

import type { OrderStatus } from '@/lib/domain';

import { useMethodName } from '../hooks/useMethodName';
import { useUi } from '../store/uiStore';
import type { SellerOrder, SellerProduct } from '../types';
import { COLLECTION_TINT, payLabel } from '../util/derive';
import { COLLECTION_ICON, Ic } from './icons';
import s from './seller.module.css';

export { clsx as cx, s };

/** Product thumbnail: cover photo, or the collection's tinted icon tile. */
export function Thumb({
  p,
  size = 44,
}: {
  p: Pick<SellerProduct, 'photos' | 'collection'> | null | undefined;
  size?: number;
}) {
  const photo = p?.photos?.[0];
  if (photo)
    return (
      <span
        className={s.thumb}
        style={{ width: size, height: size, backgroundImage: `url(${photo})` }}
      />
    );
  const col = p?.collection ?? '';
  return (
    <span
      className={clsx(s.thumb, s[`t${COLLECTION_TINT[col] ?? 1}`])}
      style={{ width: size, height: size }}
    >
      <Ic name={COLLECTION_ICON[col] ?? 'box'} size={size * 0.5} />
    </span>
  );
}

export function Stars({ n }: { n: number }) {
  const t = useTranslations('seller');
  return (
    <span className={s.star} aria-label={t('reviews.starsOf', { n })}>
      {[1, 2, 3, 4, 5].map((k) => (
        // The prototype's filled stars render as outlines (its fill attribute is overridden).
        <Ic key={k} name="star" size={13} style={k <= n ? undefined : { opacity: 0.3 }} />
      ))}
    </span>
  );
}

const SPILL: Record<OrderStatus, string> = {
  NEW: 'warn',
  ACCEPTED: 'info',
  PACKED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'ok',
  PICKED_UP: 'ok',
  CANCELLED: 'neutral',
  RETURNED: 'bad',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const t = useTranslations('seller.status');
  return <span className={clsx(s.pill, s[SPILL[status]])}>{t(status)}</span>;
}

export function PayPill({ o }: { o: SellerOrder }) {
  const t = useTranslations('seller.pay');
  const name = useMethodName();
  const pay = payLabel(o);
  return o.payment.paid ? (
    <span className={clsx(s.pill, s.ok)}>{t('paid', { pay: name(pay) })}</span>
  ) : (
    <span className={clsx(s.pill, s.warn)}>
      {pay === 'COD' ? t('codLong') : t('unpaid', { pay: name(pay) })}
    </span>
  );
}

function useAutofocus(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || el.contains(document.activeElement)) return;
    const f =
      el.querySelector<HTMLElement>('[data-autofocus]') ??
      el.querySelector<HTMLElement>(
        'input:not([type=radio]):not([type=checkbox]):not([readonly]),textarea,select',
      ) ??
      el.querySelector<HTMLElement>('button:not([data-close])');
    f?.focus({ preventScroll: true });
    // Only on mount: later re-renders must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Centred glass modal (bottom sheet ≤640px). Scrim click and the × close it. */
export function Modal({
  children,
  wide,
  className,
  noClose,
  label,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
  noClose?: boolean;
  label?: string;
}) {
  const t = useTranslations('seller.common');
  const close = useUi((u) => u.close);
  const ref = useRef<HTMLDivElement>(null);
  useAutofocus(ref);
  return (
    <div
      className={s.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={clsx(s.modal, wide && s.wide, className)}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {!noClose && (
          <button
            type="button"
            className={s.close}
            data-close
            aria-label={t('close')}
            onClick={() => close()}
          >
            <Ic name="x" size={18} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Right-hand floating drawer (bottom sheet ≤640px). */
export function Drawer({ children, label }: { children: ReactNode; label?: string }) {
  const close = useUi((u) => u.close);
  const ref = useRef<HTMLElement>(null);
  useAutofocus(ref);
  return (
    <div
      className={clsx(s.scrim, s.scrimRight)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside ref={ref} className={s.drawer} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </div>
  );
}

export function CloseButton({ className }: { className?: string }) {
  const t = useTranslations('seller.common');
  const close = useUi((u) => u.close);
  return (
    <button
      type="button"
      className={clsx(s.close, s.closeStatic, className)}
      data-close
      aria-label={t('close')}
      onClick={() => close()}
    >
      <Ic name="x" size={18} />
    </button>
  );
}

/** iOS-style switch (prototype `.sw`). */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <span className={s.sw}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span />
    </span>
  );
}

/** Label + hint + switch row (prototype `.swr`). */
export function SwitchRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={s.swr}>
      <span>
        <strong>{title}</strong>
        {hint && <span className={s.hint}>{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

/** The single toast (5 s, optional action such as Undo). */
export function ToastHost() {
  const toast = useUi((u) => u.toast);
  const hide = useUi((u) => u.hideToast);
  if (!toast) return null;
  return (
    <div key={toast.id} className={s.toast} role="status">
      <span>{toast.msg}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            hide();
            toast.action?.fn();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
