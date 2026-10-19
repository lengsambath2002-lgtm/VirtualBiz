import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

import s from './feedback.module.css';

export type StatusKind = 'notFound' | 'error' | 'offline' | 'empty' | 'forbidden';

// One stroke drawing per kind (24×24), in the circle above the title.
const ART: Record<StatusKind, string> = {
  // A map with a question mark: nothing at this address.
  notFound:
    'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v6M15 15.5v.01M13.4 10.2a1.7 1.7 0 1 1 2.4 1.5c-.5.2-.8.6-.8 1.1',
  // A warning triangle.
  error: 'M12 3 2 20h20L12 3zM12 10v4.5M12 17.5v.01',
  // A cloud with a slash.
  offline: 'M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 9.2 4.5 4.5 0 0 0 7 18zM4 4l16 16',
  // An empty tray.
  empty: 'M3 13h5l1.5 3h5l1.5-3h5M3 13l2.5-7h13L21 13v6H3z',
  // A lock.
  forbidden: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 14.5v2',
};

/**
 * The shared "nothing to show" view: page not found, something went wrong, offline, an empty
 * list, or no access. `size="page"` fills a page; `"panel"` sits inside a card or table.
 * Callers pass translated text, so this works in server and client components alike.
 */
export function StatusView({
  kind,
  title,
  body,
  code,
  actions,
  size = 'page',
  footnote,
  className,
}: {
  kind: StatusKind;
  title: string;
  body?: ReactNode;
  /** Shown small above the title, e.g. "404". */
  code?: string;
  actions?: ReactNode;
  size?: 'page' | 'panel';
  /** Small print under the actions (e.g. an error reference). */
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(s.view, s[size], s[kind], className)}
      role={kind === 'error' || kind === 'offline' ? 'alert' : 'status'}
    >
      <span className={s.art} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ART[kind]} />
        </svg>
      </span>
      {code && <span className={s.code}>{code}</span>}
      {size === 'page' ? (
        <h1 className={s.title}>{title}</h1>
      ) : (
        <h2 className={s.title}>{title}</h2>
      )}
      {body && <p className={s.body}>{body}</p>}
      {actions && <div className={s.actions}>{actions}</div>}
      {footnote && <span className={s.ref}>{footnote}</span>}
    </div>
  );
}

/** Button and link classes matching the view (`primary` for the main action). */
export const feedbackButton = (primary?: boolean) => cn(s.btn, primary && s.primary);

export { s as feedbackStyles };
