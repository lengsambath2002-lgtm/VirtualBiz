import { describe, expect, it } from 'vitest';

import { pageItems } from './Pagination';

describe('pageItems', () => {
  it('shows every page when there are few', () => {
    expect(pageItems(0, 4)).toEqual([0, 1, 2, 3]);
  });
  it('keeps first, last and two either side, with gaps', () => {
    expect(pageItems(10, 40)).toEqual([0, 'gap', 8, 9, 10, 11, 12, 'gap', 39]);
    expect(pageItems(0, 40)).toEqual([0, 1, 2, 'gap', 39]);
    expect(pageItems(39, 40)).toEqual([0, 'gap', 37, 38, 39]);
  });
});
