'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

import s from '../shop.module.css';

/**
 * The first `step` rows of a list, and `step` more each time "Show more" is pressed (the
 * marketplace's grids and reviews). Starts again from the first `step` when `resetKey` changes
 * (another tab, filter or rating).
 */
export function useShowMore<T>(rows: readonly T[], step = 12, resetKey: unknown = null) {
  const [n, setN] = useState(step);
  const key = JSON.stringify(resetKey);
  useEffect(() => setN(step), [key, step]);
  return {
    rows: rows.slice(0, n),
    more: {
      shown: Math.min(n, rows.length),
      total: rows.length,
      onMore: () => setN((x) => x + step),
    },
  };
}

/** "Showing 12 of 40 · Show more"; nothing when everything fits. */
export function ShowMore({
  shown,
  total,
  onMore,
}: {
  shown: number;
  total: number;
  onMore: () => void;
}) {
  const t = useTranslations('shop.common');
  if (total <= shown) return null;
  return (
    <div className={s.more}>
      <span className={cn(s.muted, s.small, 'num')} aria-live="polite">
        {t('showing', { shown, total })}
      </span>
      <button type="button" className={cn(s.btn, s.btnGhost, s.btnSm)} onClick={onMore}>
        {t('showMore')}
      </button>
    </div>
  );
}
