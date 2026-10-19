import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Stronger fill + float shadow (popovers, menus). */
  strong?: boolean;
  /** Lift on hover (product/shop cards). */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PAD = { none: '', sm: 'p-2', md: 'p-4', lg: 'p-6' } as const;

/** Glass material panel (radius 20). */
export function GlassCard({
  strong,
  interactive,
  padding = 'md',
  className,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-md',
        PAD[padding],
        interactive &&
          'transition-[transform,box-shadow] duration-200 ease-glass hover:-translate-y-px hover:shadow-glass-float',
        className,
      )}
      {...rest}
    />
  );
}
