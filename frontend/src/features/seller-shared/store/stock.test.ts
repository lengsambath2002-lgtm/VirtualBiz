import { beforeEach, describe, expect, it } from 'vitest';

import type { StockWriteResult } from '@/lib/api';

import type { SellerDb } from '../types';
import {
  clearPending,
  isTmp,
  reconcileWrite,
  revertStock,
  SYSTEM_USER,
  takePending,
  writeStock,
} from './stock';

const db = (): SellerDb =>
  ({
    shop: { id: 'biz', ownerId: 'u-sonita', ownerName: 'Kry Sonita' },
    products: [{ id: 'p', lowStockAt: 2, variants: [{ id: 'v', stock: 5, options: {} }] }],
    log: [],
  }) as unknown as SellerDb;

const result = (id: string, delta: number, stock: number, merged = false): StockWriteResult => ({
  movement: { id, variantId: 'v', delta, reason: 'QUICK_ADJUST', at: new Date().toISOString() },
  variant: { id: 'v', productId: 'p', stock },
  merged,
});

describe('writeStock (client half of the single stock writer)', () => {
  beforeEach(() => clearPending());

  it('shows the change at once and queues it for the API', () => {
    const d = db();
    const id = writeStock(d, { variantId: 'v', delta: -2, reason: 'POS_SALE', note: 'R-05400' });
    expect(id && isTmp(id)).toBe(true);
    expect(d.products[0]!.variants[0]!.stock).toBe(3);
    expect(d.log[0]).toMatchObject({ id, delta: -2, reason: 'POS_SALE', byName: 'Kry Sonita' });
    const [w] = takePending();
    expect(w).toMatchObject({
      localId: id,
      businessId: 'biz',
      input: { variantId: 'v', delta: -2, reason: 'POS_SALE', note: 'R-05400' },
    });
    expect(takePending()).toHaveLength(0);
  });

  it('logs changes as the user and ignores zero / unknown variants', () => {
    const d = db();
    writeStock(d, { variantId: 'v', delta: 1, reason: 'RECEIVED' });
    expect(d.log[0]!.byUserId).not.toBe(SYSTEM_USER);
    expect(takePending()[0]!.input).not.toHaveProperty('system');
    expect(writeStock(d, { variantId: 'v', delta: 0, reason: 'RECEIVED' })).toBeNull();
    expect(writeStock(d, { variantId: 'x', delta: 1, reason: 'RECEIVED' })).toBeNull();
    expect(takePending()).toHaveLength(0);
  });

  it('takes the server row and count; a merged quick adjust folds into one row', () => {
    const d = db();
    const a = writeStock(d, {
      variantId: 'v',
      delta: 1,
      reason: 'QUICK_ADJUST',
      mergeQuick: true,
    })!;
    const b = writeStock(d, {
      variantId: 'v',
      delta: 1,
      reason: 'QUICK_ADJUST',
      mergeQuick: true,
    })!;
    const batch = takePending();
    expect(batch[1]!.input.mergeQuick).toBe(true);
    reconcileWrite(d, a, result('m1', 1, 6), batch.slice(1));
    expect(d.products[0]!.variants[0]!.stock).toBe(7); // 6 on the server + 1 still queued
    reconcileWrite(d, b, result('m1', 2, 7, true), []);
    expect(d.log).toHaveLength(1);
    expect(d.log[0]).toMatchObject({ id: 'm1', delta: 2 });
    expect(d.products[0]!.variants[0]!.stock).toBe(7);
  });

  it('can undo a movement locally', () => {
    const d = db();
    const id = writeStock(d, { variantId: 'v', delta: 4, reason: 'RECEIVED' })!;
    revertStock(d, id);
    expect(d.products[0]!.variants[0]!.stock).toBe(5);
    expect(d.log).toHaveLength(0);
  });
});
