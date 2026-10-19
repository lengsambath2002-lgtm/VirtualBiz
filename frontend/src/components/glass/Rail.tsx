'use client';

import type { ReactNode } from 'react';

import { Link, usePathname } from '@/lib/i18n/navigation';
import { useScrollMini } from '@/lib/hooks/useScrollMini';
import { cn } from '@/lib/utils/cn';

import type { NavItem } from './nav';

export interface RailProps {
  items: NavItem[];
  label: string;
  /** Rendered at the top on desktop (e.g. <Logo markOnly />); hidden on phones. */
  header?: ReactNode;
  /** Rendered at the bottom on desktop (e.g. account menu); hidden on phones. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Floating side navigation for the Seller / Provider workspaces. On ≤860px it becomes a
 * bottom capsule that shrinks to icons while scrolling down.
 */
export function Rail({ items, label, header, footer, className }: RailProps) {
  const pathname = usePathname();
  const mini = useScrollMini();
  return (
    <nav aria-label={label} data-mini={mini} className={cn('vb-rail', className)}>
      {header && <div className="vb-rail-hide-m mb-3">{header}</div>}
      {items.map((item) => {
        const on = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative grid w-[62px] justify-items-center gap-[3px] rounded-[18px] py-2 text-[10.5px] font-medium text-muted',
              'hover:bg-sunk hover:text-ink max-[860px]:w-auto max-[860px]:flex-1 max-[860px]:rounded-capsule max-[860px]:py-1.5',
              on && 'bg-glass-strong text-ink shadow-[0_2px_10px_rgba(0,0,0,.08)]',
              item.hideOnMobile && 'vb-rail-hide-m',
            )}
          >
            {item.icon}
            <span className="vb-rail-label">{item.label}</span>
            {!!item.badge && (
              <span className="absolute right-3 top-1 grid h-4 min-w-4 place-items-center rounded-capsule bg-[#FF3B30] px-1 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
      {footer && (
        <>
          <div className="vb-rail-hide-m flex-1" />
          <div className="vb-rail-hide-m">{footer}</div>
        </>
      )}
    </nav>
  );
}
