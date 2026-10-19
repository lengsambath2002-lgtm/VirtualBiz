import { round2 } from '@/lib/money';

/** Unit price before discount: base + the price deltas of the chosen option values. */
export function unitPrice(base: number, optionDeltas: readonly number[] = []): number {
  return round2(optionDeltas.reduce((sum, d) => sum + d, base));
}

/**
 * Net price shown to the customer: (base + option deltas) × (1 − off%), to the cent
 * (ported from the Customer prototype's `net()`).
 */
export function netPrice(base: number, optionDeltas: readonly number[] = [], offPct = 0): number {
  return round2(unitPrice(base, optionDeltas) * (1 - offPct / 100));
}
