'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import L from './sidenav.module.css';

export interface SideNavItem {
  key: string;
  /** Locale-less path; the Link adds the locale. */
  href: string;
  label: string;
  icon: ReactNode;
  /** Count shown beside the label (a dot when the sidebar is collapsed); hidden when 0. */
  badge?: number;
  /** What the count is, in words ("12 shops waiting for an ID check"): hover text and its name. */
  badgeHint?: string;
  /** The list filtered to exactly what the count counts; clicking the count opens it. */
  badgeHref?: string;
  /** Active only on this exact path (a workspace's home), not its children. */
  exact?: boolean;
  /** One of the few destinations in the phone's bottom bar. */
  tab?: boolean;
}

export interface SideNavSection {
  key: string;
  /** Group heading ("Sell", "Customers"); none for the first group. */
  title?: string;
  items: SideNavItem[];
}

export interface SideNavAction {
  key: string;
  label: string;
  icon: ReactNode;
  /** A link (opens the marketplace in a new tab when `external`) or a button. */
  href?: string;
  external?: boolean;
  onClick?: () => void;
}

const COLLAPSED_KEY = 'vb-sidenav-collapsed';

const isOn = (pathname: string, i: SideNavItem) =>
  i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + '/');

/**
 * The workspaces' and console's navigation (docs/ui/navigation.md): a sidebar with grouped,
 * labelled destinations, the shop (or console) at the top and Settings / View shop / Log out at
 * the bottom. It collapses to icons (remembered on this device; automatic on tablets). Phones get
 * a bottom bar with the main destinations and "More", which opens the whole sidebar as a drawer.
 */
export function SideNav({
  label,
  brand,
  sections,
  footer,
}: {
  /** The navigation landmark's name ("Seller workspace"). */
  label: string;
  /** The block at the top: logo, name and status. Receives whether the sidebar is collapsed. */
  brand: (collapsed: boolean) => ReactNode;
  sections: SideNavSection[];
  footer: (SideNavItem | SideNavAction)[];
}) {
  const t = useTranslations('common.nav');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      /* storage blocked: start expanded */
    }
  }, []);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* not remembered */
    }
  };

  // The drawer closes on navigation and with Escape, and takes focus while open.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setDrawer(false);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [drawer]);

  const all = sections.flatMap((s) => s.items);
  const tabs = all.filter((i) => i.tab);
  const moreBadge = all.filter((i) => !i.tab).reduce((n, i) => n + (i.badge ?? 0), 0);
  const moreOn = !tabs.some((i) => isOn(pathname, i));

  const count = (n: number) => (n > 99 ? '99+' : String(n));
  const item = (i: SideNavItem) => {
    const on = isOn(pathname, i);
    const hint = i.badge ? i.badgeHint : undefined;
    const link = (
      <Link
        key={i.key}
        href={i.href}
        className={cn(L.item, on && L.on, !!i.badge && !!i.badgeHref && L.withCount)}
        aria-current={on ? 'page' : undefined}
        title={collapsed ? (hint ? `${i.label} · ${hint}` : i.label) : undefined}
      >
        <span className={L.icon} aria-hidden>
          {i.icon}
          {!!i.badge && <i className={L.dot} />}
        </span>
        <span className={L.text}>{i.label}</span>
        {!!i.badge && !i.badgeHref && (
          <span className={L.count} title={hint}>
            {count(i.badge)}
          </span>
        )}
      </Link>
    );
    if (!i.badge || !i.badgeHref) return link;
    // The count is its own link to the filtered list, so it says what it counts and shows it.
    return (
      <div key={i.key} className={L.row}>
        {link}
        <Link
          href={i.badgeHref}
          className={cn(L.count, L.countLink)}
          aria-label={hint ?? count(i.badge)}
          title={hint}
        >
          {count(i.badge)}
        </Link>
      </div>
    );
  };
  const action = (a: SideNavItem | SideNavAction) => {
    if ('onClick' in a && a.onClick) {
      return (
        <button
          key={a.key}
          type="button"
          className={L.item}
          onClick={a.onClick}
          title={collapsed ? a.label : undefined}
        >
          <span className={L.icon} aria-hidden>
            {a.icon}
          </span>
          <span className={L.text}>{a.label}</span>
        </button>
      );
    }
    if ('external' in a && a.external && a.href) {
      return (
        <a
          key={a.key}
          href={a.href}
          target="_blank"
          rel="noopener"
          className={L.item}
          title={collapsed ? a.label : undefined}
        >
          <span className={L.icon} aria-hidden>
            {a.icon}
          </span>
          <span className={L.text}>{a.label}</span>
          <svg className={L.ext} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path
              d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      );
    }
    return item(a as SideNavItem);
  };

  const body = (inDrawer: boolean) => (
    <>
      <div className={L.brand}>{brand(collapsed && !inDrawer)}</div>
      <div className={L.scroll}>
        {sections.map((s) => (
          <div key={s.key} className={L.group} role="group" aria-label={s.title}>
            {s.title && <span className={L.heading}>{s.title}</span>}
            {s.items.map(item)}
          </div>
        ))}
      </div>
      <div className={L.foot}>{footer.map(action)}</div>
    </>
  );

  return (
    <>
      <nav aria-label={label} className={cn(L.side, collapsed && L.collapsed)}>
        {body(false)}
        {/* A round handle on the sidebar's edge, half-way down. */}
        <button
          type="button"
          className={L.handle}
          aria-label={collapsed ? t('expand') : t('collapse')}
          aria-expanded={!collapsed}
          title={collapsed ? t('expand') : t('collapse')}
          onClick={toggle}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path
              d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </nav>

      <nav aria-label={t('tabs', { name: label })} className={L.tabbar}>
        {tabs.map((i) => {
          const on = isOn(pathname, i);
          return (
            <Link
              key={i.key}
              href={i.href}
              className={cn(L.tab, on && L.tabOn)}
              aria-current={on ? 'page' : undefined}
            >
              <span className={L.icon} aria-hidden>
                {i.icon}
                {!!i.badge && (
                  <b className={L.tabBadge} title={i.badgeHint}>
                    {count(i.badge)}
                  </b>
                )}
              </span>
              <span>{i.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={cn(L.tab, moreOn && L.tabOn)}
          aria-expanded={drawer}
          aria-haspopup="dialog"
          onClick={() => setDrawer(true)}
        >
          <span className={L.icon} aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {moreBadge > 0 && <i className={L.dot} />}
          </span>
          <span>{t('more')}</span>
        </button>
      </nav>

      {drawer && (
        <div
          className={L.scrim}
          onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}
        >
          <nav
            ref={drawerRef}
            aria-label={label}
            className={L.drawer}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className={L.close}
              aria-label={t('close')}
              onClick={() => setDrawer(false)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {body(true)}
          </nav>
        </div>
      )}
    </>
  );
}

/** The shop (or console) block at the top of the sidebar. */
export function SideNavBrand({
  mark,
  name,
  sub,
  collapsed,
}: {
  mark: ReactNode;
  name: string;
  sub?: ReactNode;
  collapsed: boolean;
}) {
  return (
    <div className={cn(L.brandRow, collapsed && L.brandMini)} title={collapsed ? name : undefined}>
      <span className={L.mark}>{mark}</span>
      <span className={L.brandText}>
        <strong>{name}</strong>
        {sub && <span>{sub}</span>}
      </span>
    </div>
  );
}

/** Lays out the sidebar column and the page column. */
export const sideNavFrame = L.frame;
/** Hide in the header while the sidebar shows the same thing (wider than a phone). */
export const phoneOnly = L.phoneOnly;
