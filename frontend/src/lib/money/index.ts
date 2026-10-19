// The one place money is formatted (ARCHITECTURE.md §1). USD is the stored currency; KHR is
// derived as round(usd × rate / 100) × 100. The rate comes from `meta` — 4100 is the default.

export const KHR_PER_USD = 4100;

/** Round a number to 2 decimal places (cents), avoiding 1.005 → 1.00 drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round a riel amount to the nearest 100 KHR. */
export function rielRound(khr: number): number {
  return Math.round(khr / 100) * 100;
}

/** USD → KHR, rounded to 100 riel. */
export function usdToKhr(usd: number, rate: number = KHR_PER_USD): number {
  return rielRound(usd * rate);
}

/** "$1,234.50" — always 2 decimals; negative as "-$3.00". */
export function formatUsd(usd: number): string {
  const abs = Math.abs(usd).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (usd < 0 ? '-$' : '$') + abs;
}

/** "$1,235" — rounded to whole dollars (summary figures, mock price tags). */
export function formatUsdWhole(usd: number): string {
  const abs = Math.round(Math.abs(usd)).toLocaleString('en-US');
  return (usd < 0 ? '-$' : '$') + abs;
}

/** "10,300 KHR" for a riel amount (already in KHR). */
export function formatKhr(khr: number): string {
  return Math.round(khr).toLocaleString('en-US') + ' KHR';
}

/** "10,300 KHR" for a USD amount (converted + rounded to 100). */
export function formatUsdAsKhr(usd: number, rate: number = KHR_PER_USD): string {
  return formatKhr(usdToKhr(usd, rate));
}

export interface CashTender {
  /** Total due, USD. */
  totalUsd: number;
  /** Dollars handed over. */
  tenderedUsd: number;
  /** Riel handed over. */
  tenderedKhr: number;
  rate?: number;
}

export interface CashResult {
  /** Everything tendered, expressed in USD. */
  paidUsd: number;
  /** paid − total, 2 dp. Negative means money is still due. */
  changeUsd: number;
  /** True when the tender covers the total (within half a cent). */
  covered: boolean;
  /** When not covered: what is still due, USD and KHR (rounded to 100). */
  dueUsd: number;
  dueKhr: number;
  /** Change split as whole dollars + the remainder in riel (rounded to 100). */
  giveUsd: number;
  giveKhr: number;
  /** All the change in riel (rounded to 100). */
  allKhr: number;
}

/**
 * POS cash tender in USD + KHR (ported from the Seller prototype's POS "Cash" pane).
 * Change is given back as whole dollars plus the cents remainder in riel; if the riel part
 * rounds up to a full dollar it is carried into the dollars.
 */
export function cashChange({
  totalUsd,
  tenderedUsd,
  tenderedKhr,
  rate = KHR_PER_USD,
}: CashTender): CashResult {
  const paidUsd = (tenderedUsd || 0) + (tenderedKhr || 0) / rate;
  const changeUsd = round2(paidUsd - totalUsd);
  const covered = changeUsd > -0.005;
  if (!covered) {
    return {
      paidUsd,
      changeUsd,
      covered,
      dueUsd: -changeUsd,
      dueKhr: rielRound(-changeUsd * rate),
      giveUsd: 0,
      giveKhr: 0,
      allKhr: 0,
    };
  }
  const change = Math.max(0, changeUsd);
  let giveUsd = Math.floor(change + 1e-9);
  let giveKhr = rielRound((change - giveUsd) * rate);
  if (giveKhr >= rate) {
    giveUsd += 1;
    giveKhr -= rate;
  }
  return {
    paidUsd,
    changeUsd: change,
    covered,
    dueUsd: 0,
    dueKhr: 0,
    giveUsd,
    giveKhr,
    allKhr: rielRound(change * rate),
  };
}

/** "$3 + 2,000 KHR", "$3" or "2,000 KHR" (or "$0" when no change). */
export function formatCashChange(giveUsd: number, giveKhr: number): string {
  const parts: string[] = [];
  if (giveUsd > 0 || giveKhr === 0) parts.push('$' + giveUsd.toLocaleString('en-US'));
  if (giveKhr > 0) parts.push(formatKhr(giveKhr));
  return parts.join(' + ');
}
