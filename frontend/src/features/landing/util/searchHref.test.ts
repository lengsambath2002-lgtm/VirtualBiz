import { describe, expect, it } from 'vitest';

import { searchHref } from './searchHref';

describe('searchHref', () => {
  it('passes q, district and category as query params', () => {
    expect(searchHref({ q: 'iced latte', district: 'bkk1' })).toEqual({
      pathname: '/search',
      query: { q: 'iced latte', district: 'bkk1' },
    });
    expect(searchHref({ category: 'cafe' })).toEqual({
      pathname: '/search',
      query: { category: 'cafe' },
    });
  });

  it('drops empty params', () => {
    expect(searchHref({ q: '', district: 'toul-kork' })).toEqual({
      pathname: '/search',
      query: { district: 'toul-kork' },
    });
    expect(searchHref()).toEqual({ pathname: '/search', query: {} });
  });
});
