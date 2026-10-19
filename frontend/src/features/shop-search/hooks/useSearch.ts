'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { api, type SearchResult } from '@/lib/api';
import { DISTRICT_CENTER, type LatLng } from '@/lib/geo';

import { marketItemToItem, shopToView } from '@/features/shop-shared/catalog';
import type { Item, ShopView } from '@/features/shop-shared/types';

import type { SearchState } from '../util/searchParams';

/** Query string for `GET /api/marketplace/search` (the customer's point, else district centre). */
export function searchQueryString(f: SearchState, area: string, here: LatLng | null): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.type !== 'all') p.set('type', f.type);
  if (f.cats.length) p.set('category', f.cats.join(','));
  if (f.min) p.set('min', f.min);
  if (f.max) p.set('max', f.max);
  if (f.rating) p.set('rating', String(f.rating));
  if (f.sale) p.set('sale', '1');
  if (f.open) p.set('open', '1');
  if (f.freeDel) p.set('freeDel', '1');
  if (f.sort !== 'best') p.set('sort', f.sort);
  const from = here ?? DISTRICT_CENTER[area];
  if (from) {
    p.set('lat', String(from.lat));
    p.set('lng', String(from.lng));
  }
  if (area) p.set('district', area);
  return p.toString();
}

/** Server-side search: filtered, sorted items and the matching shops (nearest first). */
export function useSearch(f: SearchState, area: string, here: LatLng | null) {
  const qs = searchQueryString(f, area, here);
  const q = useQuery({
    queryKey: ['shop', 'search', qs],
    queryFn: () => api.get<SearchResult>(`/marketplace/search?${qs}`, { auth: false }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const result = useMemo(
    (): { items: Item[]; shops: ShopView[] } => ({
      items: (q.data?.items ?? []).map(marketItemToItem),
      shops: (q.data?.shops ?? []).map(shopToView),
    }),
    [q.data],
  );
  return {
    ...result,
    loading: q.isPending,
    error: q.data ? null : q.error,
    retry: () => void q.refetch(),
  };
}
