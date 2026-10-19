import { describe, expect, it } from 'vitest';

import {
  cashChange,
  formatCashChange,
  formatKhr,
  formatUsd,
  formatUsdAsKhr,
  formatUsdWhole,
  rielRound,
  round2,
  usdToKhr,
} from './index';

describe('formatUsd', () => {
  it('formats with 2 decimals and thousands separators', () => {
    expect(formatUsd(2)).toBe('$2.00');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(224.1)).toBe('$224.10');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(-3)).toBe('-$3.00');
  });
});

describe('formatUsdWhole', () => {
  it('rounds to whole dollars with thousands separators', () => {
    expect(formatUsdWhole(829)).toBe('$829');
    expect(formatUsdWhole(5900)).toBe('$5,900');
    expect(formatUsdWhole(99.5)).toBe('$100');
    expect(formatUsdWhole(0)).toBe('$0');
    expect(formatUsdWhole(-6)).toBe('-$6');
  });
});

describe('usdToKhr', () => {
  it('converts at 4100 and rounds to 100 riel', () => {
    expect(usdToKhr(1)).toBe(4100);
    expect(usdToKhr(2.5)).toBe(10300); // 10,250 → 10,300
    expect(usdToKhr(0.75)).toBe(3100); // 3,075 → 3,100
    expect(usdToKhr(829)).toBe(3398900);
    expect(usdToKhr(0)).toBe(0);
  });
  it('accepts a custom rate', () => {
    expect(usdToKhr(1, 4000)).toBe(4000);
  });
  it('rielRound rounds to the nearest 100', () => {
    expect(rielRound(149)).toBe(100);
    expect(rielRound(150)).toBe(200);
  });
});

describe('formatKhr', () => {
  it('formats riel amounts', () => {
    expect(formatKhr(10300)).toBe('10,300 KHR');
    expect(formatUsdAsKhr(2.5)).toBe('10,300 KHR');
  });
});

describe('round2', () => {
  it('rounds half up at cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('cashChange', () => {
  it('splits change into whole dollars + riel', () => {
    // $7.25 due, $10 given → $2.75 change → $2 + 3,100 KHR (0.75 × 4100 = 3075 → 3100)
    const r = cashChange({ totalUsd: 7.25, tenderedUsd: 10, tenderedKhr: 0 });
    expect(r.covered).toBe(true);
    expect(r.changeUsd).toBe(2.75);
    expect(r.giveUsd).toBe(2);
    expect(r.giveKhr).toBe(3100);
    expect(r.allKhr).toBe(11300);
    expect(formatCashChange(r.giveUsd, r.giveKhr)).toBe('$2 + 3,100 KHR');
  });

  it('accepts mixed USD + KHR tender', () => {
    // $12 due, $10 + 10,000 KHR (≈ $2.4390) → change ≈ $0.44 → $0 + 1,800 KHR
    const r = cashChange({ totalUsd: 12, tenderedUsd: 10, tenderedKhr: 10000 });
    expect(r.changeUsd).toBe(0.44);
    expect(r.giveUsd).toBe(0);
    expect(r.giveKhr).toBe(1800);
    expect(formatCashChange(r.giveUsd, r.giveKhr)).toBe('1,800 KHR');
  });

  it('reports what is still due', () => {
    const r = cashChange({ totalUsd: 20, tenderedUsd: 10, tenderedKhr: 20500 });
    expect(r.covered).toBe(false);
    expect(r.dueUsd).toBe(5);
    expect(r.dueKhr).toBe(20500);
  });

  it('exact tender gives no change', () => {
    const r = cashChange({ totalUsd: 6, tenderedUsd: 6, tenderedKhr: 0 });
    expect(r.covered).toBe(true);
    expect(r.giveUsd).toBe(0);
    expect(r.giveKhr).toBe(0);
    expect(formatCashChange(r.giveUsd, r.giveKhr)).toBe('$0');
  });

  it('whole-dollar change has no riel part', () => {
    const r = cashChange({ totalUsd: 829, tenderedUsd: 850, tenderedKhr: 0 });
    expect(formatCashChange(r.giveUsd, r.giveKhr)).toBe('$21');
  });

  it('carries a riel remainder that rounds to a full dollar', () => {
    // $0.99 change → 4,059 → 4,100 KHR = $1 → $1 + 0 KHR
    const r = cashChange({ totalUsd: 9.01, tenderedUsd: 10, tenderedKhr: 0 });
    expect(r.giveUsd).toBe(1);
    expect(r.giveKhr).toBe(0);
  });
});
