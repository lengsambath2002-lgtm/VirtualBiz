import { describe, expect, it } from 'vitest';

import { acceptedMethods, policyOf, vatIncluded } from './policy';

describe('shop policy', () => {
  it('fills missing fields with the defaults', () => {
    expect(policyOf(null)).toMatchObject({
      taxPct: 0,
      payCash: true,
      payKhqr: true,
      payCard: true,
    });
    expect(policyOf({ payCard: false, receiptFooter: null }).payCard).toBe(false);
  });

  it('finds the VAT inside a VAT-inclusive total', () => {
    expect(vatIncluded(110, 10)).toBe(10);
    expect(vatIncluded(12.5, 10)).toBe(1.14);
    expect(vatIncluded(50, 0)).toBe(0);
  });

  it('lists the accepted counter methods in order', () => {
    expect(acceptedMethods(policyOf({ payKhqr: false }))).toEqual(['CASH', 'CARD']);
  });
});
