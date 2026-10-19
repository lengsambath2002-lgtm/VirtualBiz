import { describe, expect, it } from 'vitest';

import { parseSearch, searchHref } from './searchParams';

describe('search params', () => {
  it('round-trips filters through the URL', () => {
    const href = searchHref({
      q: 'latte',
      type: 'product',
      cats: ['cafe', 'grocery'],
      sale: true,
      sort: 'low',
    });
    expect(href.query).toEqual({
      q: 'latte',
      type: 'product',
      category: 'cafe,grocery',
      sale: '1',
      sort: 'low',
    });
    const st = parseSearch(new URLSearchParams(href.query));
    expect(st.cats).toEqual(['cafe', 'grocery']);
    expect(st.sale).toBe(true);
    expect(st.sort).toBe('low');
  });
  it('accepts what the landing sends and ignores junk', () => {
    const st = parseSearch(
      new URLSearchParams('q=iced&district=toul-kork&category=spa&type=nope&min=1x0'),
    );
    expect(st).toMatchObject({ q: 'iced', cats: ['spa'], type: 'all', min: '10' });
  });
});
