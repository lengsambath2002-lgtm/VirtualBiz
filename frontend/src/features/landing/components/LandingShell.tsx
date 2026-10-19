import type { ReactNode } from 'react';

import s from './landing.module.css';

/** Page scope for the landing: landing-only tokens, base type size and smooth anchor scrolling. */
export function LandingShell({ children }: { children: ReactNode }) {
  return <div className={s.root}>{children}</div>;
}
