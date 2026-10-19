import { SUPPORTED_LOCALES } from '@/lib/i18n/config';

/**
 * Where to go after signing in, from `?next=`. Only same-site paths are allowed (no
 * "//host" or "https://…"), and a leading locale segment is dropped because the
 * locale-aware router adds the current one.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  let p = next;
  for (const l of SUPPORTED_LOCALES) {
    if (p === `/${l}`) p = '/';
    else if (p.startsWith(`/${l}/`) || p.startsWith(`/${l}?`)) p = p.slice(l.length + 1);
  }
  if (p.startsWith('?')) p = '/' + p;
  // Never bounce back into the auth pages themselves.
  if (/^\/sign-(?:in|up)(?:[/?#]|$)/.test(p)) return null;
  return p;
}

/** Where a signed-in user lands: `?next=` when it's safe, otherwise the marketplace home. */
export const afterSignIn = (next: string | null | undefined): string =>
  safeNextPath(next) ?? '/home';
