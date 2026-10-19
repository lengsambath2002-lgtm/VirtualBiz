'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

/**
 * A list page's filters live in the URL (`?q=…&status=…&page=2`), so a filtered view can be
 * linked to and survives a reload. Changing any filter goes back to the first page.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ''])) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp, keys.join(',')],
  );
  const page = Math.max(0, Number(sp.get('page') ?? 0) || 0);
  const set = useCallback(
    (patch: Partial<Record<K | 'page', string | number>>) => {
      const next = new URLSearchParams(sp.toString());
      if (!('page' in patch)) next.delete('page');
      for (const [k, v] of Object.entries(patch)) {
        if (v === '' || v === undefined || v === null || (k === 'page' && v === 0)) next.delete(k);
        else next.set(k, String(v));
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { values, page, set };
}
