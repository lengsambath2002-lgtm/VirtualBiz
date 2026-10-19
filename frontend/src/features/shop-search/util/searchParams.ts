// Customer search state lives in the URL (/search?q=&type=&category=a,b&min=&max=&rating=
// &sale=1&open=1&freeDel=1&sort=). The landing sends q, district and category.

export type SearchType = 'all' | 'product' | 'service' | 'shop';
export type SearchSort = 'best' | 'near' | 'rating' | 'low' | 'high';

export interface SearchState {
  q: string;
  type: SearchType;
  /** Category ids. */
  cats: string[];
  min: string;
  max: string;
  rating: number;
  sale: boolean;
  open: boolean;
  freeDel: boolean;
  sort: SearchSort;
}

export const EMPTY_SEARCH: SearchState = {
  q: '',
  type: 'all',
  cats: [],
  min: '',
  max: '',
  rating: 0,
  sale: false,
  open: false,
  freeDel: false,
  sort: 'best',
};

const TYPES: SearchType[] = ['all', 'product', 'service', 'shop'];
const SORTS: SearchSort[] = ['best', 'near', 'rating', 'low', 'high'];

interface ParamsLike {
  get(name: string): string | null;
}

export function parseSearch(p: ParamsLike): SearchState {
  const type = p.get('type') as SearchType | null;
  const sort = p.get('sort') as SearchSort | null;
  const num = (v: string | null) => (v ?? '').replace(/[^\d.]/g, '');
  return {
    q: p.get('q') ?? '',
    type: type && TYPES.includes(type) ? type : 'all',
    cats: (p.get('category') ?? '').split(',').filter(Boolean),
    min: num(p.get('min')),
    max: num(p.get('max')),
    rating: Number(p.get('rating')) || 0,
    sale: p.get('sale') === '1',
    open: p.get('open') === '1',
    freeDel: p.get('freeDel') === '1',
    sort: sort && SORTS.includes(sort) ? sort : 'best',
  };
}

export interface SearchHrefInput extends Partial<Omit<SearchState, 'cats'>> {
  category?: string[];
  cats?: string[];
}

/** Locale-less `/search` href for the next-intl Link / router; defaults are dropped. */
export function searchHref(input: SearchHrefInput = {}) {
  const st = { ...EMPTY_SEARCH, ...input, cats: input.cats ?? input.category ?? [] };
  const query: Record<string, string> = {};
  if (st.q) query.q = st.q;
  if (st.type !== 'all') query.type = st.type;
  if (st.cats.length) query.category = st.cats.join(',');
  if (st.min) query.min = st.min;
  if (st.max) query.max = st.max;
  if (st.rating) query.rating = String(st.rating);
  if (st.sale) query.sale = '1';
  if (st.open) query.open = '1';
  if (st.freeDel) query.freeDel = '1';
  if (st.sort !== 'best') query.sort = st.sort;
  return { pathname: '/search' as const, query };
}
