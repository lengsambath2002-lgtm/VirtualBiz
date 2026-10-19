'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Accessible label for the close button (pass a translated string). */
  closeLabel: string;
  children: ReactNode;
  className?: string;
}

/**
 * Modal sheet: centred glass card on desktop, bottom sheet with a grabber at ≤640px.
 * Closes on Escape and scrim click; focus moves into the sheet and back on close.
 */
export function Sheet({ open, onClose, title, closeLabel, children, className }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="vb-scrim fixed inset-0 z-[60] grid animate-fade place-items-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'vb-sheet glass-strong relative grid max-h-[calc(100dvh-32px)] w-full max-w-[480px] gap-4 overflow-auto rounded-lg p-6 outline-none',
          className,
        )}
      >
        {title && (
          <h2 id={titleId} className="pr-9 text-[19px] font-semibold">
            {title}
          </h2>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-capsule bg-sunk text-muted hover:text-ink"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
