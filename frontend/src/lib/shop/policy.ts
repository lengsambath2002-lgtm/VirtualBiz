import type { ShopPolicy } from '@/lib/domain';
import { round2 } from '@/lib/money';

/** A shop's policy before it set one (the API's defaults). */
export const DEFAULT_POLICY: ShopPolicy = {
  taxPct: 0,
  payCash: true,
  payKhqr: true,
  payCard: true,
};

/** `p` with every missing field taken from the defaults. */
export const policyOf = (p?: Partial<ShopPolicy> | null): ShopPolicy => ({
  ...DEFAULT_POLICY,
  ...Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== null && v !== undefined)),
});

/** The VAT inside a VAT-inclusive total (USD, 2 dp); 0 without a rate. */
export const vatIncluded = (total: number, pct: number) =>
  pct > 0 ? round2((total * pct) / (100 + pct)) : 0;

/** Counter payment methods the shop takes, in display order. */
export const acceptedMethods = (p: ShopPolicy): ('CASH' | 'KHQR' | 'CARD')[] =>
  (['CASH', 'KHQR', 'CARD'] as const).filter((m) =>
    m === 'CASH' ? p.payCash : m === 'KHQR' ? p.payKhqr : p.payCard,
  );
