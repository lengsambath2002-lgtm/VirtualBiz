// What a platform sign-in must remember across a page change in this tab: the route while the
// person enters a two-step code, the organisations for the connect screen, the link ticket while
// they sign in to their VirtualBiz account. sessionStorage: this tab only, gone when it closes.
import type { PendingLink, PlatformRoute } from '../types';

const ROUTE = 'vb-platform-route';
const LINK = 'vb-platform-link';

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked storage: the person starts again */
  }
}

export const savedRoute = () => read<PlatformRoute>(ROUTE);
export const saveRoute = (r: PlatformRoute | null) => write(ROUTE, r);
export const savedLink = () => read<PendingLink>(LINK);
export const saveLink = (l: PendingLink | null) => write(LINK, l);
