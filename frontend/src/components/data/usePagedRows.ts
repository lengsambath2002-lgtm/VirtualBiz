'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './paging';

/**
 * Pages a list the screen already holds (the workspace's products, reviews, promotions…), with the
 * page and rows-per-page in the URL like the server-paged lists (`?page=2&size=50`), so a page can
 * be reloaded and linked to. `prefix` keeps two lists on one screen apart (`?dpage=1`). A page past
 * the end (rows were removed, a filter narrowed the list) shows the last page.
 *
 * `resetOn` lists what narrows the rows (search text, filters, sort): when any of it changes, the
 * list goes back to its first page. Spread `pager` into `<Pagination {...pager} />`.
 */
export function usePagedRows<T>(
  rows: readonly T[],
  opts: { size?: number; prefix?: string; resetOn?: readonly unknown[] } = {},
) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pageKey = `${opts.prefix ?? ''}page`;
  const sizeKey = `${opts.prefix ?? ''}size`;
  const defaultSize = opts.size ?? DEFAULT_PAGE_SIZE;

  const rawSize = Number(sp.get(sizeKey) ?? defaultSize);
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : defaultSize;
  const last = Math.max(0, Math.ceil(rows.length / size) - 1);
  const asked = Math.max(0, Number(sp.get(pageKey) ?? 0) || 0);
  const page = Math.min(asked, last);

  const set = useCallback(
    (patch: Record<string, number>) => {
      const next = new URLSearchParams(
        typeof window === 'undefined' ? sp.toString() : window.location.search,
      );
      for (const [k, v] of Object.entries(patch)) {
        const isDefault = (k === pageKey && v === 0) || (k === sizeKey && v === defaultSize);
        if (isDefault) next.delete(k);
        else next.set(k, String(v));
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [sp, router, pathname, pageKey, sizeKey, defaultSize],
  );

  // A new search, filter or sort starts at the first page (not on the first render: a reloaded or
  // linked page keeps its number).
  const resetKey = JSON.stringify(opts.resetOn ?? []);
  const lastKey = useRef(resetKey);
  useEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    if (asked) set({ [pageKey]: 0 });
  }, [resetKey, asked, pageKey, set]);

  // Tidy a page number past the end out of the URL once the rows are known.
  useEffect(() => {
    if (rows.length && asked > last) set({ [pageKey]: last });
  }, [rows.length, asked, last, pageKey, set]);

  const shown = useMemo(() => rows.slice(page * size, (page + 1) * size), [rows, page, size]);
  return {
    rows: shown,
    pager: {
      page,
      size,
      total: rows.length,
      onPage: (p: number) => set({ [pageKey]: p }),
      onSize: (s: number) => set({ [sizeKey]: s, [pageKey]: 0 }),
    },
  };
}
