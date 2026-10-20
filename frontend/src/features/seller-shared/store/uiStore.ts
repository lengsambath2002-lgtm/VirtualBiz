'use client';

// Transient workspace UI (not persisted): the single open overlay (the prototype shows one
// modal/drawer at a time), the toast, top-bar menus and the product editor's dirty flag.
import { create } from 'zustand';

export type ConfirmValue = string | boolean;
export type ConfirmValues = Record<string, ConfirmValue>;

export type ConfirmField =
  | {
      type: 'select';
      key: string;
      label: string;
      options: { value: string; label: string }[];
      value?: string;
    }
  | { type: 'switch'; key: string; label: string; hint?: string; value: boolean }
  | {
      type: 'input';
      key: string;
      label: string;
      value?: string;
      placeholder?: string;
      inputMode?: 'decimal' | 'numeric' | 'text' | 'tel';
      list?: { value: string; label: string }[];
    };

export interface ConfirmSpec {
  title: string;
  body?: string;
  ok: string;
  danger?: boolean;
  /** An array entry renders as a two-column row. */
  fields?: (ConfirmField | ConfirmField[])[];
}

export type Overlay =
  | { kind: 'confirm'; spec: ConfirmSpec; resolve: (v: ConfirmValues | null) => void }
  | { kind: 'order'; id: string }
  | { kind: 'manual' }
  | { kind: 'customer'; id: string }
  | { kind: 'pack'; id: string }
  | { kind: 'ship'; id: string }
  | { kind: 'invoice'; id: string }
  | { kind: 'palette' }
  | { kind: 'scan' }
  | { kind: 'receive' }
  | { kind: 'adjust'; variantId: string; preset?: AdjustReason }
  | { kind: 'promo'; id?: string }
  | { kind: 'reply'; id: string }
  | { kind: 'posOpen' }
  | { kind: 'posCharge' }
  | { kind: 'posReceipt'; saleId: string; fresh: boolean }
  | { kind: 'posRefund'; saleId: string }
  | { kind: 'posReceipts' }
  | { kind: 'posHeld' }
  | { kind: 'posVariant'; productId: string }
  | { kind: 'posClose' };

export type AdjustReason = 'recv' | 'count' | 'dmg' | 'ret';

export interface ToastSpec {
  id: number;
  msg: string;
  action?: { label: string; fn: () => void };
}

interface UiState {
  overlay: Overlay | null;
  toast: ToastSpec | null;
  menu: 'new' | 'notifs' | null;
  editorDirty: boolean;
  /** Open an overlay, replacing (silently closing) the current one. */
  open: (o: Overlay) => void;
  /** Close the overlay; unless `silent`, focus goes back to where it was. */
  close: (silent?: boolean) => void;
  confirm: (spec: ConfirmSpec) => Promise<ConfirmValues | null>;
  showToast: (msg: string, action?: ToastSpec['action']) => void;
  hideToast: () => void;
  setMenu: (m: UiState['menu']) => void;
  setEditorDirty: (d: boolean) => void;
}

let lastFocus: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;

export const useUi = create<UiState>()((set, get) => ({
  overlay: null,
  toast: null,
  menu: null,
  editorDirty: false,
  open: (o) => {
    const cur = get().overlay;
    if (cur?.kind === 'confirm') cur.resolve(null);
    if (!cur && typeof document !== 'undefined')
      lastFocus = document.activeElement as HTMLElement | null;
    set({ overlay: o });
  },
  close: (silent) => {
    const cur = get().overlay;
    if (cur?.kind === 'confirm') cur.resolve(null);
    set({ overlay: null });
    if (!silent && lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  },
  confirm: (spec) =>
    new Promise((resolve) => {
      get().open({
        kind: 'confirm',
        spec,
        resolve: (v) => {
          resolve(v);
        },
      });
    }),
  showToast: (msg, action) => {
    clearTimeout(toastTimer);
    set({ toast: { id: ++toastSeq, msg, ...(action ? { action } : {}) } });
    toastTimer = setTimeout(() => set({ toast: null }), 5000);
  },
  hideToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
  setMenu: (menu) => set({ menu }),
  setEditorDirty: (editorDirty) => set({ editorDirty }),
}));

/** Shorthand for components: `const toast = useToast(); toast('Saved')`. */
export const useToast = () => useUi((s) => s.showToast);
