import type { CartLine } from '@/features/shop-shared/types';

const keyOf = (l: CartLine) => `${l.pid}|${JSON.stringify(l.sel)}`;

/**
 * Three-way merge of a list the customer changed while the server's copy was loading: the
 * server's lines plus what changed locally since `base` (added lines, quantity changes, removed
 * lines).
 */
export function rebase(server: CartLine[], base: CartLine[], local: CartLine[]): CartLine[] {
  const before = new Map(base.map((l) => [keyOf(l), l]));
  const now = new Map(local.map((l) => [keyOf(l), l]));
  const out = new Map(server.map((l) => [keyOf(l), { ...l }]));
  for (const [k, l] of now) {
    const was = before.get(k);
    const delta = l.qty - (was?.qty ?? 0);
    const cur = out.get(k);
    if (cur) {
      cur.qty = Math.max(1, cur.qty + delta);
      if (!was || l.on !== was.on) cur.on = l.on;
    } else if (!was || delta > 0) out.set(k, { ...l, qty: was ? delta : l.qty });
  }
  for (const k of before.keys()) if (!now.has(k)) out.delete(k);
  return [...out.values()];
}
