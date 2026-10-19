'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

import type { BusinessDraft } from '../types';
import { isCloseAfterOpen } from '../util/draft';
import s from './onboarding.module.css';

interface HoursSheetProps {
  draft: BusinessDraft;
  onClose: () => void;
  onSave: (hours: Pick<BusinessDraft, 'open' | 'close' | 'sunday'>) => void;
  onInvalid: () => void;
}

/** "Opening hours" sheet: opens/closes (30-min steps) and the Sunday switch. */
export function HoursSheet({ draft, onClose, onSave, onInvalid }: HoursSheetProps) {
  const t = useTranslations('onboarding.hours');
  const [open, setOpen] = useState(draft.open);
  const [close, setClose] = useState(draft.close);
  const [sunday, setSunday] = useState(draft.sunday);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const done = () => {
    if (!isCloseAfterOpen(open, close)) return onInvalid();
    onSave({ open, close, sunday });
  };

  return (
    <div
      className={s.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hours-title"
        tabIndex={-1}
      >
        <h2 id="hours-title">{t('title')}</h2>
        <div className={cn(s.list, s.panel)}>
          <div className={s.hrsLine}>
            <label htmlFor="ho">{t('opens')}</label>
            <input
              id="ho"
              className={s.time}
              type="time"
              step={1800}
              value={open}
              onChange={(e) => setOpen(e.target.value)}
            />
          </div>
          <div className={s.hrsLine}>
            <label htmlFor="hc">{t('closes')}</label>
            <input
              id="hc"
              className={s.time}
              type="time"
              step={1800}
              value={close}
              onChange={(e) => setClose(e.target.value)}
            />
          </div>
          <label className={s.swr}>
            <span>
              <strong>{t('sunday')}</strong>
            </span>
            <span className={s.sw}>
              <input
                type="checkbox"
                checked={sunday}
                onChange={(e) => setSunday(e.target.checked)}
              />
              <span />
            </span>
          </label>
        </div>
        <p className={s.hint}>{t('hint')}</p>
        <button type="button" className={cn(s.btn, s.btnPrimary, s.btnBlock)} onClick={done}>
          {t('done')}
        </button>
      </div>
    </div>
  );
}
