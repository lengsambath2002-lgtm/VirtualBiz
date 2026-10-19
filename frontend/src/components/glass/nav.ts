import type { ReactNode } from 'react';

/** One destination in a TabBar or Rail. `href` is locale-less (the Link adds the locale). */
export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Badge count; hidden when 0/undefined. */
  badge?: number;
  /** Hide on the phone bottom bar (Rail only). */
  hideOnMobile?: boolean;
}
