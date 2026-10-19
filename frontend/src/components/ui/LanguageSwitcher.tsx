'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import {
  isLocale,
  LOCALE_ENDONYMS,
  LOCALE_SHORT_LABELS,
  SUPPORTED_LOCALES,
} from '@/lib/i18n/config';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Flag } from './Flag';
import { Icon } from './Icon';

/** Compact language picker: flag + short label, opening a menu of flag + endonym. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const tc = useTranslations('common');
  const current = useLocale();
  const locale = isLocale(current) ? current : SUPPORTED_LOCALES[0];
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={tc('language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--g-fill-strong)] pl-2.5 pr-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--line-h)]"
      >
        <Flag locale={locale} />
        <span>{LOCALE_SHORT_LABELS[locale]}</span>
        <Icon
          name="chevronDown"
          size={14}
          strokeWidth={2.2}
          className={cn('text-[var(--muted)] transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={tc('language')}
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[150px] rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--g-shadow-float)]"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button
                type="button"
                lang={l === 'kh' ? 'km' : l}
                onClick={() => {
                  setOpen(false);
                  if (l === locale) return;
                  // Keep ?step=, ?next= etc. Read at click time so this needs no Suspense boundary.
                  const query = Object.fromEntries(new URLSearchParams(window.location.search));
                  router.replace({ pathname, query }, { locale: l });
                }}
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[14px] text-[var(--ink)] hover:bg-[var(--sunk)]"
              >
                <Flag locale={l} />
                <span className="flex-1">{LOCALE_ENDONYMS[l]}</span>
                {l === locale && (
                  <Icon name="check" size={16} strokeWidth={2.4} className="text-[var(--ok)]" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
