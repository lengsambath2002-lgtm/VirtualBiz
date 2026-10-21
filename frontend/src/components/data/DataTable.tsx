'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent, ReactNode } from 'react';

import { EmptyRow, ErrorView } from '@/components/feedback';
import { cn } from '@/lib/utils/cn';

import d from './data.module.css';
import type { Sort } from './useListQuery';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Server sort key; the header becomes a sort button. */
  sort?: string;
  /** First direction on click (default ascending; amounts and dates read better descending). */
  sortFirst?: Sort['dir'];
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Hidden below 720px wide. */
  hideNarrow?: boolean;
}

/**
 * The shared management table (admin console and both shop workspaces): sortable headers, row
 * selection with a bulk-action bar, clickable rows, and the shared loading / error / empty
 * states. A failed load is an error with a retry, never an empty table.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  label,
  loading,
  error,
  retry,
  empty,
  sort,
  onSort,
  selected,
  onSelect,
  bulk,
  onRow,
  rowClass,
  minWidth = 680,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  /** Accessible name of the table. */
  label: string;
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
  empty: { title: string; body?: string; action?: ReactNode };
  sort?: Sort | null;
  onSort?: (key: string, firstDir?: Sort['dir']) => void;
  /** Selected row keys; with `onSelect` the table shows checkboxes. */
  selected?: ReadonlySet<string>;
  onSelect?: (keys: Set<string>) => void;
  /** Shown above the table while rows are selected (e.g. "Hide", "Export selected"). */
  bulk?: ReactNode;
  onRow?: (row: T) => void;
  rowClass?: (row: T) => string | undefined;
  minWidth?: number;
}) {
  const t = useTranslations('common.data');
  const selectable = !!onSelect;
  const cols = columns.length + (selectable ? 1 : 0);
  const keys = rows?.map(rowKey) ?? [];
  const allOn = !!keys.length && keys.every((k) => selected?.has(k));
  const someOn = keys.some((k) => selected?.has(k));

  if (error && !rows) {
    return (
      <div className={d.state}>
        <ErrorView error={error} {...(retry ? { retry } : {})} size="panel" />
      </div>
    );
  }

  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelect?.(next);
  };
  const key = (e: KeyboardEvent, row: T) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) onRow?.(row);
  };

  return (
    <div className={d.tableBox}>
      {selectable && !!selected?.size && (
        <div className={d.bulk} role="toolbar" aria-label={t('bulkLabel')}>
          <strong>{t('selected', { n: selected.size })}</strong>
          <button type="button" className={d.link} onClick={() => onSelect?.(new Set())}>
            {t('clearSelection')}
          </button>
          <span className={d.bulkActs}>{bulk}</span>
        </div>
      )}
      <div className={d.scroll}>
        <table className={d.table} style={{ minWidth }} aria-label={label} aria-busy={loading}>
          <thead>
            <tr>
              {selectable && (
                <th className={d.check}>
                  <input
                    type="checkbox"
                    aria-label={t('selectAll')}
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = someOn && !allOn;
                    }}
                    onChange={() => {
                      const next = new Set(selected);
                      for (const k of keys) {
                        if (allOn) next.delete(k);
                        else next.add(k);
                      }
                      onSelect?.(next);
                    }}
                  />
                </th>
              )}
              {columns.map((c) => {
                const on = !!sort && !!c.sort && sort.key === c.sort;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align ?? 'left' }}
                    className={cn(c.hideNarrow && d.narrowHide)}
                    aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.sort && onSort ? (
                      <button
                        type="button"
                        className={cn(d.sortBtn, on && d.sortOn)}
                        onClick={() => onSort(c.sort!, c.sortFirst)}
                      >
                        {c.header}
                        <span aria-hidden className={d.sortIc}>
                          {on ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {!rows &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk${i}`} className={d.skel} aria-hidden>
                  {Array.from({ length: cols }, (__, j) => (
                    <td key={j}>
                      <span />
                    </td>
                  ))}
                </tr>
              ))}
            {rows && !rows.length && <EmptyRow cols={cols} {...empty} />}
            {rows?.map((row) => {
              const k = rowKey(row);
              return (
                <tr
                  key={k}
                  className={cn(onRow && d.clk, selected?.has(k) && d.on, rowClass?.(row))}
                  {...(onRow
                    ? { tabIndex: 0, onClick: () => onRow(row), onKeyDown: (e) => key(e, row) }
                    : {})}
                >
                  {selectable && (
                    <td className={d.check} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={t('selectRow')}
                        checked={!!selected?.has(k)}
                        onChange={() => toggle(k)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align ?? 'left' }}
                      className={cn(c.hideNarrow && d.narrowHide)}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && rows && <div className={d.refreshing} aria-hidden />}
      {error && rows ? (
        <p className={d.staleErr} role="alert">
          {t('refreshFailed')}{' '}
          {retry && (
            <button type="button" className={d.link} onClick={retry}>
              {t('retry')}
            </button>
          )}
        </p>
      ) : null}
    </div>
  );
}
