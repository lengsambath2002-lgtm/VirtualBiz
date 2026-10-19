'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

import { k } from '../cx';
import { useUi } from '../store';
import { PIcon } from './Icon';

/** Focus the first field (or button) when an overlay opens (prototype `overlay()`). */
function useAutoFocus(ref: React.RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const s = ref.current;
    if (!s || !enabled) return;
    const f =
      s.querySelector<HTMLElement>('[autofocus],[data-autofocus]') ||
      s.querySelector<HTMLElement>(
        'input:not([type=radio]):not([type=checkbox]):not([readonly]),textarea,select',
      ) ||
      s.querySelector<HTMLElement>('button:not([data-close])');
    f?.focus({ preventScroll: true });
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function CloseButton({ style }: { style?: React.CSSProperties }) {
  const t = useTranslations('provider.common');
  const close = useUi((s) => s.close);
  return (
    <button
      type="button"
      className={k('close')}
      data-close
      aria-label={t('close')}
      onClick={() => close()}
      style={style}
    >
      <PIcon name="x" size={18} />
    </button>
  );
}

/** Centred glass modal; bottom sheet at ≤640px. */
export function Modal({
  children,
  wide,
  palette,
  label,
  autoFocus = true,
}: {
  children: ReactNode;
  wide?: boolean;
  palette?: boolean;
  label?: string;
  /** The prototype's checkout fills its body after opening, so nothing gets focus there. */
  autoFocus?: boolean;
}) {
  const close = useUi((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);
  useAutoFocus(ref, autoFocus);
  return (
    <div
      className={k('scrim')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={k('modal', wide && 'wide', palette && 'palette')}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {!palette && <CloseButton />}
        {children}
      </div>
    </div>
  );
}

/** Right-hand drawer; bottom sheet at ≤640px. Children render header / body / footer. */
export function Drawer({ children, label }: { children: ReactNode; label?: string }) {
  const close = useUi((s) => s.close);
  const ref = useRef<HTMLElement>(null);
  useAutoFocus(ref);
  return (
    <div
      className={k('scrim right')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside ref={ref} className={k('drawer')} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </div>
  );
}

/** Prototype `confirmBox`: title, body, extra fields (`data-k`), Cancel / OK. */
export function ConfirmBox() {
  const t = useTranslations('provider.common');
  const overlay = useUi((s) => s.overlay);
  const close = useUi((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);
  if (overlay?.t !== 'confirm') return null;
  const { opts, resolve } = overlay;
  return (
    <Modal label={opts.title}>
      <div ref={ref} style={{ display: 'contents' }}>
        <h2>{opts.title}</h2>
        {opts.body ? <p className={k('muted')}>{opts.body}</p> : null}
        {opts.extra}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            className={k('btn btn-ghost')}
            onClick={() => {
              resolve(null);
              close();
            }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className={k('btn', opts.danger ? 'btn-danger' : 'btn-primary')}
            onClick={() => {
              const d: Record<string, string> = {};
              ref.current
                ?.querySelectorAll<
                  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                >('[data-k]')
                .forEach((el) => {
                  d[el.dataset.k!] = el.value;
                });
              resolve(d);
              close(true);
            }}
          >
            {opts.ok ?? t('confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Single toast with an optional action; disappears after 5 s (prototype `toast`). */
export function ProviderToast() {
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(hide, 5000);
    return () => clearTimeout(h);
  }, [toast, hide]);
  if (!toast) return null;
  return (
    <div key={toast.id} className={k('toast')} role="status">
      <span>{toast.msg}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            hide();
            toast.action!.fn();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

/** Form field wrapper with the prototype's `.field` / `.bad` / `.err` markup. */
export function Field({
  id,
  label,
  error,
  children,
  hidden,
}: {
  id?: string;
  label?: ReactNode;
  error?: string;
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <div className={k('field', error && 'bad')} hidden={hidden}>
      {label !== undefined &&
        (id ? <label htmlFor={id}>{label}</label> : <span className={k('lbl')}>{label}</span>)}
      {children}
      {error !== undefined && <div className={k('err')}>{error}</div>}
    </div>
  );
}
