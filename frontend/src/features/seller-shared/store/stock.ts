// Client half of the ONE stock-movement writer (CLAUDE.md "Stock"). The server's
// `inventory.service.StockWriter` owns stock; online orders change it on the server. In the
// workspace every change — inventory adjustments and the still-local POS screen — goes
// through `writeStock`, which shows the change at once (count + a provisional `tmp-` log
// row) and queues it for `POST /api/inventory/movements`. The store sends the queue in order
// and replaces each provisional row with the server's row (`reconcileWrite`).
import type { StockWriteResult } from '@/lib/api';
import type { StockReason } from '@/lib/domain';

import { SYSTEM_USER, toMovement, type StockWriteInput } from '../api';
import type { SellerDb } from '../types';
import { findVariant } from '../util/derive';

export { SYSTEM_USER };

export interface StockWrite {
  variantId: string;
  delta: number;
  reason: StockReason;
  note?: string;
  /** Quick ±1 taps within a minute fold into the previous "Quick adjust" row (server-side). */
  mergeQuick?: boolean;
}

/** A write waiting for the API: the provisional row id plus the request. */
export interface PendingWrite {
  localId: string;
  businessId: string;
  input: StockWriteInput;
}

let tmpSeq = 0;
let pending: PendingWrite[] = [];

export const isTmp = (id: string) => id.startsWith('tmp-');

/** Apply a stock change to a draft of the seller state and queue it. Returns the row id. */
export function writeStock(d: SellerDb, w: StockWrite): string | null {
  if (!w.delta) return null;
  const [, v] = findVariant(d.products, w.variantId);
  if (!v) return null;
  v.stock += w.delta;
  const id = `tmp-${Date.now().toString(36)}-${(tmpSeq++).toString(36)}`;
  d.log.push({
    id,
    variantId: w.variantId,
    delta: w.delta,
    reason: w.reason,
    byUserId: d.shop.ownerId,
    byName: d.shop.ownerName,
    ...(w.note ? { note: w.note } : {}),
    at: new Date().toISOString(),
  });
  pending.push({
    localId: id,
    businessId: d.shop.id,
    input: {
      variantId: w.variantId,
      delta: w.delta,
      reason: w.reason,
      ...(w.note ? { note: w.note } : {}),
      ...(w.mergeQuick ? { mergeQuick: true } : {}),
    },
  });
  return id;
}

/** Take the queued writes (oldest first). */
export function takePending(): PendingWrite[] {
  const out = pending;
  pending = [];
  return out;
}

export const hasPending = () => pending.length > 0;

/** Drop queued writes (e.g. after a failure the state is reloaded from the API). */
export function clearPending() {
  pending = [];
}

/** Sum of the not-yet-sent deltas of a variant (kept on top of the server's count). */
export const pendingDelta = (variantId: string, extra: PendingWrite[] = []) =>
  [...pending, ...extra]
    .filter((p) => p.input.variantId === variantId)
    .reduce((a, p) => a + p.input.delta, 0);

/**
 * The API confirmed a write: drop the provisional row, upsert the server's row (a merged quick
 * adjust updates the existing one) and take the server's count plus what is still queued.
 */
export function reconcileWrite(
  d: SellerDb,
  localId: string,
  r: StockWriteResult,
  stillQueued: PendingWrite[],
) {
  d.log = d.log.filter((m) => m.id !== localId);
  const row = toMovement(r.movement);
  const i = d.log.findIndex((m) => m.id === row.id);
  if (i >= 0) d.log[i] = row;
  else d.log.push(row);
  d.log.sort((a, b) => a.at.localeCompare(b.at));
  const [, v] = findVariant(d.products, r.variant.id);
  if (v) v.stock = r.variant.stock + pendingDelta(r.variant.id, stillQueued);
}

/** Undo one logged movement locally (the API call follows): reverse it and drop the row. */
export function revertStock(d: SellerDb, id: string): void {
  const i = d.log.findIndex((m) => m.id === id);
  const m = d.log[i];
  if (!m) return;
  const [, v] = findVariant(d.products, m.variantId);
  if (v) v.stock -= m.delta;
  d.log.splice(i, 1);
}
