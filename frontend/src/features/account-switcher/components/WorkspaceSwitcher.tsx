'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ProfileSwitcher, type ActiveProfile } from './ProfileSwitcher';
import s from './switcher.module.css';

/**
 * The workspace top bar's avatar: opens the profile switcher so the owner can go back to their
 * personal account or jump to another business.
 */
export function WorkspaceSwitcher({
  businessId,
  active,
  label,
  className,
  children,
}: {
  businessId?: string;
  /** The profile shown as current; defaults to the business. */
  active?: ActiveProfile;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations('common.switcher');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={root} className={s.anchor}>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <div className={s.pop} role="menu" aria-label={t('title')}>
          <div className={s.popTitle}>{t('title')}</div>
          <ProfileSwitcher
            active={active ?? { kind: 'business', id: businessId ?? '' }}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
