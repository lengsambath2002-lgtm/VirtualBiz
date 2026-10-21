'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { apiDownload, isApiError, saveBlob } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { isDay, presetOf, RANGE_PRESETS, rangeOf, type RangePreset } from '@/lib/utils/dateRange';

import d from './data.module.css';
import { SavedViews } from './SavedViews';

export interface ActiveFilter {
  key: string;
  /** "Status: Pending" */
  label: string;
  onClear: () => void;
}

/**
 * Search, filters and list actions in one bar, with the active filters as removable chips and
 * "Clear all". The search waits for a pause in typing before it changes the URL.
 */
export function FilterBar({
  q,
  onQ,
  placeholder,
  label,
  children,
  active = [],
  onClearAll,
  actions,
  views,
}: {
  q?: string;
  onQ?: (q: string) => void;
  placeholder?: string;
  /** The search box's accessible name ("Search shops"); defaults to the placeholder. */
  label?: string;
  children?: ReactNode;
  active?: ActiveFilter[];
  onClearAll?: () => void;
  /** Right-hand buttons: Export, Import, New … */
  actions?: ReactNode;
  /** The list's key for saved views ("admin.orders"); shows the views control. */
  views?: string;
}) {
  const t = useTranslations('common.data');
  const [text, setText] = useState(q ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setText(q ?? ''), [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={d.filterBar}>
      <div className={d.filterRow}>
        {onQ && (
          <label className={d.search}>
            <span className={d.srOnly}>{label ?? placeholder ?? t('search')}</span>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={text}
              placeholder={placeholder ?? t('search')}
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => onQ(v.trim()), 350);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  clearTimeout(timer.current);
                  onQ(text.trim());
                }
              }}
            />
          </label>
        )}
        {children}
        {(actions || views) && (
          <div className={d.actions}>
            {views && <SavedViews list={views} />}
            {actions}
          </div>
        )}
      </div>
      {!!active.length && (
        <div className={d.chips} aria-label={t('activeFilters')}>
          {active.map((a) => (
            <span key={a.key} className={d.chip}>
              {a.label}
              <button
                type="button"
                aria-label={t('removeFilter', { what: a.label })}
                onClick={a.onClear}
              >
                ×
              </button>
            </span>
          ))}
          {onClearAll && active.length > 1 && (
            <button type="button" className={d.link} onClick={onClearAll}>
              {t('clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A labelled select for one filter ("Status: Any"). */
export function SelectFilter({
  label,
  value,
  options,
  onChange,
  anyLabel,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  anyLabel?: string;
}) {
  const t = useTranslations('common.data');
  return (
    <label className={cn(d.select, value && d.selectOn)}>
      <span aria-hidden>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{anyLabel ?? t('any')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Status tabs with counts ("All 1,204 · Pending 12 · …"). */
export function SegmentFilter({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string; count?: number }[];
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className={d.segs} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={cn(d.seg, value === o.value && d.segOn)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count != null && <span className={d.segN}>{o.count.toLocaleString('en-US')}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Date range: a preset ("Last 30 days", "This month" …) or two custom days. Empty means any time.
 * Days are Phnom Penh days, `to` inclusive.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  label,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
}) {
  const t = useTranslations('common.data');
  const has = isDay(from) && isDay(to);
  const preset = has ? presetOf({ from, to }) : null;
  const [custom, setCustom] = useState(has && !preset);
  const mode = custom ? 'custom' : (preset ?? '');
  return (
    <div className={cn(d.range, has && d.selectOn)}>
      <label className={d.select}>
        <span aria-hidden>{label ?? t('date')}</span>
        <select
          aria-label={label ?? t('date')}
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'custom') {
              setCustom(true);
              if (!has) onChange(rangeOf('last30').from, rangeOf('last30').to);
            } else {
              setCustom(false);
              if (!v) onChange('', '');
              else {
                const r = rangeOf(v as RangePreset);
                onChange(r.from, r.to);
              }
            }
          }}
        >
          <option value="">{t('anyTime')}</option>
          {RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {t(`ranges.${p}`)}
            </option>
          ))}
          <option value="custom">{t('ranges.custom')}</option>
        </select>
      </label>
      {custom && (
        <span className={d.days}>
          <input
            type="date"
            aria-label={t('from')}
            value={from}
            max={to || undefined}
            onChange={(e) => e.target.value && onChange(e.target.value, to || e.target.value)}
          />
          <span aria-hidden>–</span>
          <input
            type="date"
            aria-label={t('to')}
            value={to}
            min={from || undefined}
            onChange={(e) => e.target.value && onChange(from || e.target.value, e.target.value)}
          />
        </span>
      )}
    </div>
  );
}

/**
 * Downloads a CSV the API makes for the list as it is filtered now (`path` includes the query).
 * Shows its own progress and failure.
 */
export function ExportButton({
  path,
  businessId,
  label,
  className,
}: {
  path: string;
  businessId?: string;
  label?: string;
  className?: string;
}) {
  const t = useTranslations('common.data');
  const [state, setState] = useState<'idle' | 'busy' | 'failed' | 'forbidden'>('idle');
  const run = async () => {
    setState('busy');
    try {
      const { blob, filename } = await apiDownload(path, businessId ? { businessId } : {});
      saveBlob(blob, filename ?? 'export.csv');
      setState('idle');
    } catch (e) {
      setState(isApiError(e, 'FORBIDDEN') ? 'forbidden' : 'failed');
    }
  };
  return (
    <span className={d.exportWrap}>
      <button
        type="button"
        className={cn(d.btn, className)}
        disabled={state === 'busy'}
        onClick={() => void run()}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {state === 'busy' ? t('exporting') : (label ?? t('export'))}
      </button>
      {(state === 'failed' || state === 'forbidden') && (
        <span className={d.exportErr} role="alert">
          {state === 'forbidden' ? t('exportForbidden') : t('exportFailed')}
        </span>
      )}
    </span>
  );
}

/**
 * Chips for a list's active filters: `label[key](value)` names each one ("Status: Suspended");
 * `from`/`to` become one date chip worded by `range`.
 */
export function chipsFor<K extends string>(
  list: {
    values: Record<K, string>;
    set: (patch: { [P in K]?: string }) => void;
  },
  label: Partial<Record<K, (v: string) => string>>,
  range?: (from: string, to: string) => string,
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const v = list.values as Record<string, string>;
  for (const [k, fn] of Object.entries(label) as [K, ((v: string) => string) | undefined][]) {
    if (fn && list.values[k]) {
      out.push({
        key: k,
        label: fn(list.values[k]),
        onClear: () => list.set({ [k]: '' } as { [P in K]?: string }),
      });
    }
  }
  if (range && (v.from || v.to)) {
    out.push({
      key: 'range',
      label: range(v.from ?? '', v.to ?? ''),
      onClear: () => list.set({ from: '', to: '' } as unknown as { [P in K]?: string }),
    });
  }
  return out;
}

/** Words a date filter for its chip: "Placed: Last 30 days", or the two days. */
export function useRangeLabel(what?: string) {
  const t = useTranslations('common.data');
  return (from: string, to: string) => {
    const name = what ?? t('date');
    const preset = isDay(from) && isDay(to) ? presetOf({ from, to }) : null;
    const when = preset
      ? t(`ranges.${preset}`)
      : from && to
        ? t('between', { from, to })
        : from
          ? t('since', { from })
          : t('until', { to });
    return `${name}: ${when}`;
  };
}
