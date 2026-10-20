'use client';

import type { ReactNode } from 'react';
import { create } from 'zustand';

import type { ClientFilter } from './util/logic';
import type { ProviderAppointment, ProviderData } from './types';

// ---------------------------------------------------------------------------------------------
// Workspace data: loaded from the API when the workspace opens (see useProviderData) and kept
// current by the live stream. Actions call the API and then put its answer here.

interface DataState {
  data: ProviderData | null;
  set: (data: ProviderData | null) => void;
  /** Mutate a copy of the data and commit it. */
  update: (fn: (d: ProviderData) => void) => void;
}

export const useProviderStore = create<DataState>()((set) => ({
  data: null,
  set: (data) => set({ data }),
  update: (fn) =>
    set((s) => {
      if (!s.data) return s;
      const d = structuredClone(s.data);
      fn(d);
      return { data: d };
    }),
}));

/** Replace (or add) the appointment the API returned. */
export function putAppointment(a: ProviderAppointment) {
  useProviderStore.getState().update((d) => {
    const i = d.appointments.findIndex((x) => x.id === a.id);
    if (i >= 0) d.appointments[i] = a;
    else d.appointments.push(a);
  });
}

/** The loaded data (callers render only once it is there, see ProviderShell). */
export function useData(): ProviderData {
  const d = useProviderStore((s) => s.data);
  if (!d) throw new Error('provider data not loaded');
  return d;
}

// ---------------------------------------------------------------------------------------------
// UI state that survives page changes but not reloads (prototype `S`), plus the single overlay
// and the toast.

export interface ApptFormOpts {
  id?: string;
  date?: string;
  start?: number;
  staffId?: string;
  walkin?: boolean;
  clientId?: string;
  /** Preselect a service (Rebook / Book again). */
  serviceId?: string;
  /** Restores a draft after "Double-book?" is cancelled. */
  draft?: {
    clientText: string;
    clientId: string;
    phone: string;
    serviceId: string;
    staffId: string;
    date: string;
    start: number;
    note: string;
  };
}

export interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  ok?: string;
  danger?: boolean;
  /** Extra fields; inputs with `data-k` are returned by key. */
  extra?: ReactNode;
}

export type Overlay =
  | { t: 'appt'; id: string }
  | { t: 'apptForm'; opts: ApptFormOpts }
  | { t: 'checkout'; id?: string }
  | { t: 'receipt'; saleId: string; change?: number | null }
  | { t: 'requests' }
  | { t: 'client'; id: string }
  | { t: 'newClient' }
  | { t: 'slot'; staffId: string; date: string; start: number }
  | { t: 'block'; date?: string; start?: number; staffId?: string }
  | { t: 'confirm'; opts: ConfirmOpts; resolve: (v: Record<string, string> | null) => void }
  | { t: 'svcForm'; id?: string; cat?: string }
  | { t: 'staffForm'; id?: string }
  | { t: 'dealForm'; id?: string }
  | { t: 'reply'; reviewId: string }
  | { t: 'palette' };

export interface ToastState {
  id: number;
  msg: string;
  action?: { label: string; fn: () => void };
}

interface UiState {
  overlay: Overlay | null;
  /** Element focused before the overlay opened (focus returns there on close). */
  lastFocus: HTMLElement | null;
  toast: ToastState | null;
  menu: 'new' | 'n' | null;
  dragging: boolean;
  clientQ: string;
  clientF: ClientFilter;
  salesR: 1 | 7 | 30;
  payF: 'all' | 'CASH' | 'KHQR' | 'CARD';
  mkTab: 'deals' | 'reviews';
  setTab: 'business' | 'hours' | 'rules';
  open: (o: Overlay) => void;
  close: (silent?: boolean) => void;
  confirm: (opts: ConfirmOpts) => Promise<Record<string, string> | null>;
  showToast: (msg: string, action?: ToastState['action']) => void;
  hideToast: () => void;
  set: (
    patch: Partial<
      Pick<
        UiState,
        'menu' | 'dragging' | 'clientQ' | 'clientF' | 'salesR' | 'payF' | 'mkTab' | 'setTab'
      >
    >,
  ) => void;
}

let toastSeq = 0;

export const useUi = create<UiState>()((set, get) => ({
  overlay: null,
  lastFocus: null,
  toast: null,
  menu: null,
  dragging: false,
  clientQ: '',
  clientF: 'all',
  salesR: 7,
  payF: 'all',
  mkTab: 'deals',
  setTab: 'business',
  open: (o) => {
    const prev = get().overlay;
    if (prev?.t === 'confirm') prev.resolve(null);
    set({
      overlay: o,
      lastFocus:
        typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    });
  },
  close: (silent) => {
    const { overlay, lastFocus } = get();
    if (overlay?.t === 'confirm') overlay.resolve(null);
    set({ overlay: null });
    if (!silent && lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  },
  confirm: (opts) =>
    new Promise((resolve) => {
      get().open({ t: 'confirm', opts, resolve });
    }),
  showToast: (msg, action) => set({ toast: { id: ++toastSeq, msg, action } }),
  hideToast: () => set({ toast: null }),
  set: (patch) => set(patch),
}));
