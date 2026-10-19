'use client';

import { clsx } from 'clsx';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import s from './palette.module.css';

/** One result. Commands are listed in the order given; a header shows when `group` changes. */
export interface PaletteCommand {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  /** Text searched (lower-cased) when there's no `match`. Defaults to `label`. */
  keywords?: string;
  /** Custom matcher, given the trimmed lower-case query. */
  match?: (q: string) => boolean;
  /** List this command while the query is empty (e.g. page shortcuts). Default false. */
  showWhenEmpty?: boolean;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
  /** Max results per group (e.g. `{ Orders: 5, Products: 5 }`). */
  groupLimits?: Record<string, number>;
  placeholder: string;
  /** Accessible name for the search field. */
  ariaLabel: string;
  /** Shown when nothing matches. */
  emptyLabel: string;
}

/**
 * Ctrl/⌘K command palette: type to filter, ↑/↓ to move, Enter to run, Esc or the scrim to
 * close. Generic: callers pass the commands (pages, records…) and decide what each one does.
 */
export function CommandPalette({ open, ...rest }: CommandPaletteProps) {
  if (!open) return null;
  return <PaletteBody {...rest} />;
}

function PaletteBody({
  onClose,
  commands,
  groupLimits,
  placeholder,
  ariaLabel,
  emptyLabel,
}: Omit<CommandPaletteProps, 'open'>) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const used: Record<string, number> = {};
    return commands.filter((c) => {
      const hit = !query
        ? !!c.showWhenEmpty
        : c.match
          ? c.match(query)
          : (c.keywords ?? c.label).toLowerCase().includes(query);
      if (!hit) return false;
      const lim = groupLimits?.[c.group];
      used[c.group] = (used[c.group] ?? 0) + 1;
      return lim === undefined || (used[c.group] ?? 0) <= lim;
    });
  }, [q, commands, groupLimits]);

  const cur = Math.min(idx, Math.max(0, items.length - 1));
  const run = (i: number) => {
    const it = items[i];
    if (!it) return;
    onClose();
    it.run();
  };

  return (
    <div
      className={s.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.panel} role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <input
          ref={inputRef}
          className={s.input}
          value={q}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx(Math.min(items.length - 1, cur + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx(Math.max(0, cur - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(cur);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className={s.res}>
          {items.length ? (
            items.map((it, i) => (
              <Fragment key={it.id}>
                {it.group !== items[i - 1]?.group && <div className={s.grp}>{it.group}</div>}
                <button
                  type="button"
                  className={clsx(s.item, i === cur && s.on)}
                  onClick={() => run(i)}
                >
                  {it.icon}
                  <span className={s.label}>{it.label}</span>
                  {it.sub && <span className={s.sub}>{it.sub}</span>}
                </button>
              </Fragment>
            ))
          ) : (
            <p className={s.none}>{emptyLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
