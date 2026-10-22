'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
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

/** Results per page; the next page loads as the customer scrolls near the end. */
export const SEARCH_PAGE = 24;

/**
 * Server-side search: filtered, sorted items and the matching shops (nearest first), a page at a
 * time. Changing a filter keeps the old results on screen (marked as updating) until the new ones
 * arrive.
 */
export function useSearch(f: SearchState, area: string, here: LatLng | null) {
  const qs = searchQueryString(f, area, here);
  const shopsOnly = f.type === 'shop';
  const q = useInfiniteQuery({
    queryKey: ['shop', 'search', qs],
    queryFn: ({ pageParam }) =>
      api.get<SearchResult>(`/marketplace/search?${qs}&page=${pageParam}&size=${SEARCH_PAGE}`, {
        auth: false,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * last.size < (shopsOnly ? last.shopTotal : last.itemTotal)
        ? last.page + 1
        : undefined,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pages = q.data?.pages;
  const result = useMemo(
    (): { items: Item[]; shops: ShopView[] } => ({
      items: (pages ?? []).flatMap((p) => p.items).map(marketItemToItem),
      shops: (pages ?? []).flatMap((p) => p.shops).map(shopToView),
    }),
    [pages],
  );
  return {
    ...result,
    itemTotal: pages?.[0]?.itemTotal ?? 0,
    shopTotal: pages?.[0]?.shopTotal ?? 0,
    loading: q.isPending,
    /** A new filter is loading while the previous results are shown. */
    updating: q.isPlaceholderData,
    error: q.data ? null : q.error,
    retry: () => void q.refetch(),
    hasMore: q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    moreFailed: q.isFetchNextPageError,
    loadMore: () => void q.fetchNextPage(),
  };
}
