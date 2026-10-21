'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';

import d from './data.module.css';
import { PAGE_SIZES, pageItems } from './paging';

/**
 * "41–60 of 1,284" with page numbers and a rows-per-page choice. Always shows the count, also when
 * everything fits on one page.
 */
export function Pagination({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
  onSize?: (s: number) => void;
}) {
  const t = useTranslations('common.data');
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? page * size + 1 : 0;
  const to = Math.min(total, (page + 1) * size);
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <nav className={d.pager} aria-label={t('pagination')}>
      <span className={d.count} aria-live="polite">
        {total ? t('range', { from: fmt(from), to: fmt(to), total: fmt(total) }) : t('none')}
      </span>
      {onSize && (
        <label className={d.sizePick}>
          <span aria-hidden>{t('perPage')}</span>
          <select
            aria-label={t('perPage')}
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {pages > 1 && (
        <div className={d.pages}>
          <button
            type="button"
            className={d.pg}
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            aria-label={t('prev')}
          >
            ‹
          </button>
          {pageItems(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`g${i}`} className={d.gap}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={cn(d.pg, p === page && d.pgOn)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={t('pageN', { n: p + 1 })}
                onClick={() => onPage(p)}
              >
                {p + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className={d.pg}
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
            aria-label={t('next')}
          >
            ›
          </button>
        </div>
      )}
    </nav>
  );
}
