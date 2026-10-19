'use client';

import { Link, usePathname } from '@/lib/i18n/navigation';
import { useScrollMini } from '@/lib/hooks/useScrollMini';
import { cn } from '@/lib/utils/cn';

import type { NavItem } from './nav';

export interface TabBarProps {
  items: NavItem[];
  /** Accessible name for the nav landmark. */
  label: string;
  className?: string;
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

/** Floating capsule tab bar (Customer, ≤700px). Shrinks to icons while scrolling down. */
export function TabBar({ items, label, className }: TabBarProps) {
  const pathname = usePathname();
  const mini = useScrollMini();
  return (
    <nav aria-label={label} data-mini={mini} className={cn('vb-tabbar', className)}>
      {items.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative grid justify-items-center gap-0.5 rounded-capsule px-0.5 py-1.5 text-[11px] text-muted',
              on && 'bg-sunk font-semibold text-ink',
            )}
          >
            {item.icon}
            <span className="vb-tab-label">{item.label}</span>
            {!!item.badge && (
              <span className="absolute left-[calc(50%+4px)] top-0.5 grid h-4 min-w-4 place-items-center rounded-capsule bg-danger px-1 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
