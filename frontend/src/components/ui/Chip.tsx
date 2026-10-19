import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected state (glass `.chip.on`). */
  selected?: boolean;
}

/** Capsule filter chip. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-[34px] flex-none items-center gap-1.5 rounded-capsule px-3.5 text-[13px] text-ink',
        selected ? 'border border-transparent bg-primary text-primary-on' : 'glass shadow-glass-hi',
        className,
      )}
      {...rest}
    />
  );
});
