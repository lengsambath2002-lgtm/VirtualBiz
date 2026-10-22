'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './paging';

export interface Sort {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * A list's state in the URL (`?q=…&status=…&from=…&to=…&sort=-total&page=2&size=50`), so a
 * filtered view survives a reload and can be linked to. Changing a filter or the sort goes back to
 * the first page. `page` is 0-based, as the API takes it.
 */
export function useListQuery<K extends string>(
  keys: readonly K[],
  opts: { size?: number; sort?: string } = {},
) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const defaultSize = opts.size ?? DEFAULT_PAGE_SIZE;
  const defaultSort = opts.sort ?? '';

  const values = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ''])) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp, keys.join(',')],
  );
  const page = Math.max(0, Number(sp.get('page') ?? 0) || 0);
  const rawSize = Number(sp.get('size') ?? defaultSize);
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : defaultSize;
  const sortParam = sp.get('sort') ?? defaultSort;
  const sort = useMemo<Sort | null>(
    () =>
      sortParam
        ? { key: sortParam.replace(/^-/, ''), dir: sortParam.startsWith('-') ? 'desc' : 'asc' }
        : null,
    [sortParam],
  );

  const set = useCallback(
    (patch: { [P in K | 'page' | 'size' | 'sort']?: string | number | null }) => {
      // The current URL, not this render's: a debounced search may land after another change.
      const next = new URLSearchParams(
        typeof window === 'undefined' ? sp.toString() : window.location.search,
      );
      if (!('page' in patch)) next.delete('page');
      for (const [k, v] of Object.entries(patch)) {
        const empty =
          v === '' ||
          v == null ||
          (k === 'page' && v === 0) ||
          (k === 'size' && v === defaultSize) ||
          (k === 'sort' && v === defaultSort);
        if (empty) next.delete(k);
        else next.set(k, String(v));
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [sp, router, pathname, defaultSize, defaultSort],
  );

  /** Header click: ascending, then descending, then back to the list's default order. */
  const toggleSort = useCallback(
    (key: string, firstDir: Sort['dir'] = 'asc') => {
      const other = firstDir === 'asc' ? 'desc' : 'asc';
      const nextDir = sort?.key !== key ? firstDir : sort.dir === firstDir ? other : null;
      set({
        sort: nextDir ? `${nextDir === 'desc' ? '-' : ''}${key}` : '',
      } as unknown as Parameters<typeof set>[0]);
    },
    [sort, set],
  );

  /** Clear every filter (keeps page size and sort). */
  const reset = useCallback(
    () => set(Object.fromEntries(keys.map((k) => [k, ''])) as unknown as Parameters<typeof set>[0]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, keys.join(',')],
  );

  const active = (keys as readonly K[]).filter((k) => values[k] !== '');

  /** Query string for the API: filters, `page`, `size` and `sort` (`-total`). */
  const apiQuery = useCallback(
    (extra: Record<string, string | number | undefined> = {}) => {
      const q = new URLSearchParams();
      for (const k of keys) if (values[k]) q.set(k, values[k]);
      q.set('page', String(page));
      q.set('size', String(size));
      if (sortParam) q.set('sort', sortParam);
      for (const [k, v] of Object.entries(extra))
        if (v !== undefined && v !== '') q.set(k, String(v));
      return q.toString();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, page, size, sortParam, keys.join(',')],
  );

  return { values, page, size, sort, set, toggleSort, reset, active, apiQuery };
}

export type ListQuery<K extends string> = ReturnType<typeof useListQuery<K>>;
