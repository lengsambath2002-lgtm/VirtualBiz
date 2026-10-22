'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';
import {
  isDay,
  ppDay,
  presetOf,
  RANGE_PRESETS,
  rangeOf,
  type RangePreset,
} from '@/lib/utils/dateRange';

import p$ from './datepicker.module.css';

/** YYYY-MM-DD ↔ a UTC-noon Date, so day arithmetic never trips over time zones. */
const toDate = (d: string) => new Date(`${d}T12:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const x = toDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toDay(x);
};
const addMonths = (d: string, n: number) => {
  const x = toDate(`${d.slice(0, 7)}-01`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return toDay(x);
};
/** "8 Oct 2026", "1 Oct – 21 Oct 2026" or "28 Dec 2025 – 3 Jan 2026" in the app's language. */
export function formatDays(from: string, to: string, locale: string): string {
  const intl = locale === 'kh' ? 'km-KH' : 'en-GB';
  const f = (d: string, year = true) =>
    toDate(d).toLocaleDateString(intl, {
      day: 'numeric',
      month: 'short',
      ...(year ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });
  if (!to || from === to) return f(from);
  return `${f(from, from.slice(0, 4) !== to.slice(0, 4))} – ${f(to)}`;
}

/** The 6 × 7 days shown for the month of `month` (weeks start on Monday). */
function monthGrid(month: string): string[] {
  const first = `${month.slice(0, 7)}-01`;
  const dow = (toDate(first).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - dow));
}

export interface DateRangePickerProps {
  /** YYYY-MM-DD, or '' for none. */
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** The field's name on the button ("Placed"). */
  label: string;
  /** 'single' picks one day (from = to). */
  mode?: 'range' | 'single';
  /** Offer "Any time" (clearing the dates). Default true for ranges. */
  clearable?: boolean;
  /** Days after this can't be picked (default: none). */
  max?: string;
  /** Days before this can't be picked. */
  min?: string;
  /** Presets shown beside the calendar (ranges only). */
  presets?: readonly RangePreset[];
  /** 'pill' sits in a filter bar with its label inside; 'field' fills a form field (label outside). */
  variant?: 'pill' | 'field';
  /** For a `<label htmlFor>` (field variant). */
  id?: string;
  disabled?: boolean;
  /** Shown when nothing is picked (default "Any time" / "Pick a day"). */
  placeholder?: string;
  /** Marks the button invalid (field variant). */
  invalid?: boolean;
  className?: string;
}

/**
 * The date picker of every management screen (docs/api/phase15-lists.md): a button with the
 * current choice; it opens presets and a calendar (two months on wide screens, one on phones)
 * where the first click picks the start and the second the end. Apply commits, Escape or a click
 * outside cancels. Keyboard: arrows move by day / week, Page Up / Down by month, Enter picks.
 * The calendar floats above the page (a portal), so dialogs and scrolling panels don't clip it;
 * on phones it is a bottom sheet with one month.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  label,
  mode = 'range',
  clearable = mode === 'range',
  max,
  min,
  presets = RANGE_PRESETS,
  variant = 'pill',
  id: fieldId,
  disabled,
  placeholder,
  invalid,
  className,
}: DateRangePickerProps) {
  const t = useTranslations('common.data');
  const locale = useLocale();
  const intl = locale === 'kh' ? 'km-KH' : 'en-GB';
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<CSSProperties>({ visibility: 'hidden' });
  const today = ppDay(new Date());
  const has = isDay(from) && isDay(to);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from, to });
  const [hover, setHover] = useState('');
  const [view, setView] = useState(() => (has ? from : today));
  const [focus, setFocus] = useState(has ? from : today);

  useEffect(() => {
    if (!open) return;
    setDraft({ from, to });
    setView(has ? (mode === 'range' ? addMonths(to, -1) : from) : today);
    setFocus(has ? from : today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on a click outside (the button or the calendar).
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!box.current?.contains(n) && !pop.current?.contains(n)) setOpen(false);
    };
    // Escape closes only the calendar (not the dialog or drawer it sits in), wherever focus is.
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setOpen(false);
      setAt({ visibility: 'hidden' });
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', off);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);

  // Place the calendar under the button, or above it when there's no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = trigger.current?.getBoundingClientRect();
      const el = pop.current;
      if (!b || !el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(8, Math.min(b.left, window.innerWidth - w - 8));
      const below = b.bottom + 6;
      const top = below + h > window.innerHeight - 8 && b.top - h - 6 >= 8 ? b.top - h - 6 : below;
      setAt({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, view]);
  const close = () => {
    setOpen(false);
    setAt({ visibility: 'hidden' });
    trigger.current?.focus();
  };

  const fmtDay = useCallback((d: string) => formatDays(d, d, locale), [locale]);
  const preset = has ? presetOf({ from, to }) : null;
  const shown = !has
    ? (placeholder ?? (mode === 'single' ? t('picker.pick') : t('anyTime')))
    : mode === 'single'
      ? fmtDay(from)
      : preset
        ? t(`ranges.${preset}`)
        : formatDays(from, to, locale);

  const blocked = (d: string) => (!!max && d > max) || (!!min && d < min);
  const pick = (d: string) => {
    if (blocked(d)) return;
    if (mode === 'single') {
      onChange(d, d);
      close();
      return;
    }
    if (!draft.from || draft.to) setDraft({ from: d, to: '' });
    else if (d < draft.from) setDraft({ from: d, to: draft.from });
    else setDraft({ from: draft.from, to: d });
  };
  const apply = () => {
    if (draft.from) onChange(draft.from, draft.to || draft.from);
    close();
  };
  const end = draft.to || (draft.from && hover && hover >= draft.from ? hover : '');
  const inRange = (d: string) => !!draft.from && !!end && d > draft.from && d < end;

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        toDate(addDays('2026-10-19', i)).toLocaleDateString(intl, {
          weekday: 'narrow',
          timeZone: 'UTC',
        }),
      ),
    [intl],
  );

  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in step) {
      e.preventDefault();
      const next = addDays(focus, step[e.key]!);
      setFocus(next);
      if (next.slice(0, 7) < view.slice(0, 7)) setView(addMonths(view, -1));
      if (next.slice(0, 7) > addMonths(view, mode === 'range' ? 1 : 0).slice(0, 7))
        setView(addMonths(view, 1));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const n = e.key === 'PageUp' ? -1 : 1;
      setFocus(addMonths(focus, n));
      setView(addMonths(view, n));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(focus);
    }
  };
  // Keep keyboard focus on the focused day.
  useEffect(() => {
    if (!open) return;
    pop.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)
      ?.focus({ preventScroll: true });
  }, [focus, open]);

  const months = mode === 'range' ? [view, addMonths(view, 1)] : [view];

  return (
    <div className={cn(p$.wrap, variant === 'field' && p$.wrapField, className)} ref={box}>
      <button
        ref={trigger}
        id={fieldId}
        type="button"
        className={cn(
          p$.trigger,
          variant === 'field' && p$.field,
          has && variant === 'pill' && p$.triggerOn,
          !has && variant === 'field' && p$.empty,
        )}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-invalid={invalid || undefined}
        aria-label={`${label}: ${shown}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {variant === 'pill' && <span className={p$.label}>{label}</span>}
        <span className={p$.value}>{shown}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <rect
            x="3.5"
            y="5"
            width="17"
            height="15"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M3.5 10h17M8 3v4M16 3v4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            className={p$.pop}
            style={at}
            role="dialog"
            aria-modal="false"
            aria-label={label}
            onKeyDown={onKey}
          >
            {mode === 'range' && (
              <ul className={p$.presets} aria-label={t('picker.presets')}>
                {clearable && (
                  <li>
                    <button
                      type="button"
                      className={cn(!has && p$.presetOn)}
                      onClick={() => {
                        onChange('', '');
                        close();
                      }}
                    >
                      {t('anyTime')}
                    </button>
                  </li>
                )}
                {presets.map((x) => (
                  <li key={x}>
                    <button
                      type="button"
                      className={cn(preset === x && p$.presetOn)}
                      onClick={() => {
                        const r = rangeOf(x);
                        onChange(r.from, r.to);
                        close();
                      }}
                    >
                      {t(`ranges.${x}`)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className={p$.cal}>
              <div className={p$.months}>
                {months.map((m, mi) => (
                  <div key={m} className={cn(p$.month, mi > 0 && p$.second)}>
                    <div className={p$.monthH}>
                      {mi === 0 ? (
                        <button
                          type="button"
                          className={p$.nav}
                          aria-label={t('picker.prevMonth')}
                          onClick={() => setView(addMonths(view, -1))}
                        >
                          ‹
                        </button>
                      ) : (
                        <span />
                      )}
                      <strong id={`${id}-${mi}`}>
                        {toDate(m).toLocaleDateString(intl, {
                          month: 'long',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </strong>
                      {mi === months.length - 1 ? (
                        <button
                          type="button"
                          className={p$.nav}
                          aria-label={t('picker.nextMonth')}
                          onClick={() => setView(addMonths(view, 1))}
                        >
                          ›
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                    <div className={p$.grid} role="grid" aria-labelledby={`${id}-${mi}`}>
                      {weekdays.map((w, i) => (
                        <span key={i} className={p$.wd} aria-hidden>
                          {w}
                        </span>
                      ))}
                      {monthGrid(m).map((d) => {
                        const other = d.slice(0, 7) !== m.slice(0, 7);
                        const start = d === draft.from;
                        const stop = d === (draft.to || (mode === 'single' ? draft.from : ''));
                        return (
                          <button
                            key={d}
                            type="button"
                            data-day={d}
                            tabIndex={d === focus ? 0 : -1}
                            disabled={blocked(d)}
                            aria-pressed={start || stop}
                            aria-label={toDate(d).toLocaleDateString(intl, {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              timeZone: 'UTC',
                            })}
                            className={cn(
                              p$.day,
                              other && p$.other,
                              d === today && p$.today,
                              inRange(d) && p$.in,
                              (start || stop) && p$.edge,
                              start && end && end !== draft.from && p$.startEdge,
                              d === end && !!draft.from && end !== draft.from && p$.endEdge,
                            )}
                            onClick={() => {
                              setFocus(d);
                              pick(d);
                            }}
                            onMouseEnter={() => setHover(d)}
                          >
                            {Number(d.slice(8))}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {mode === 'range' && (
                <div className={p$.foot}>
                  <span className={p$.sel} aria-live="polite">
                    {draft.from
                      ? `${fmtDay(draft.from)} – ${draft.to ? fmtDay(draft.to) : t('picker.pickEnd')}`
                      : t('picker.pickStart')}
                  </span>
                  <button type="button" className={p$.ghost} onClick={close}>
                    {t('picker.cancel')}
                  </button>
                  <button
                    type="button"
                    className={p$.primary}
                    disabled={!draft.from}
                    onClick={apply}
                  >
                    {t('picker.apply')}
                  </button>
                </div>
              )}
              {mode === 'single' && (clearable || !has) && (
                <div className={p$.foot}>
                  <button
                    type="button"
                    className={p$.link}
                    disabled={blocked(today)}
                    onClick={() => pick(today)}
                  >
                    {t('ranges.today')}
                  </button>
                  <span className={p$.sel} />
                  {clearable && has && (
                    <button
                      type="button"
                      className={p$.ghost}
                      onClick={() => {
                        onChange('', '');
                        close();
                      }}
                    >
                      {t('picker.clear')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
