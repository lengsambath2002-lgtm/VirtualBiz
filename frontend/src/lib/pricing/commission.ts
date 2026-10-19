import { round2 } from '@/lib/money';

/** VirtualBiz's fee on online orders and bookings. Counter (POS) sales are free. */
export const ONLINE_COMMISSION_RATE = 0.05;

export interface CommissionEstimate {
  /** Fee on the online sales, USD. */
  fee: number;
  /** All sales (online + counter) minus the fee, USD. */
  keep: number;
  /** Fee as a percentage of all sales (0 when there are no sales). */
  effectivePct: number;
}

/**
 * Monthly fee estimate from the landing pricing calculator: 5% of online sales only.
 */
export function commissionEstimate(
  onlineUsd: number,
  counterUsd: number,
  rate: number = ONLINE_COMMISSION_RATE,
): CommissionEstimate {
  const fee = round2(onlineUsd * rate);
  const all = onlineUsd + counterUsd;
  return { fee, keep: round2(all - fee), effectivePct: all ? (fee / all) * 100 : 0 };
}
