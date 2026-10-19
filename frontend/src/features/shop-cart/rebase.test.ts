import { describe, expect, it } from 'vitest';

import type { CartLine } from '@/features/shop-shared/types';

import { rebase } from './rebase';

const line = (pid: string, qty: number, on = true): CartLine => ({ pid, sel: {}, qty, on });

describe('rebase (changes made while the server cart was loading)', () => {
  it('keeps an item added during the load', () => {
    expect(rebase([line('latte', 1)], [], [line('cable', 1)])).toEqual([
      line('latte', 1),
      line('cable', 1),
    ]);
  });

  it('adds quantity changes on top of the server count', () => {
    expect(rebase([line('cable', 3)], [line('cable', 1)], [line('cable', 2)])).toEqual([
      line('cable', 4),
    ]);
  });

  it('drops a line removed during the load, keeps lines only the server has', () => {
    expect(rebase([line('cable', 1), line('latte', 2)], [line('cable', 1)], [])).toEqual([
      line('latte', 2),
    ]);
  });

  it('nothing changed locally: the server wins', () => {
    const base = [line('cable', 1)];
    expect(rebase([line('cable', 5)], base, base)).toEqual([line('cable', 5)]);
  });
});
