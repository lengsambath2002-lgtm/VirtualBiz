import 'server-only';

import type { ApiResponse } from './client';

/** Backend origin for server-side requests (same env the Next rewrite uses). */
const BACKEND =
  process.env.API_URL ||
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8180';

/**
 * GET a public API endpoint from a server component (`data`, or null when the API is
 * unreachable or answers an error, so the page can still render). Cached for `revalidate` s.
 */
export async function serverGet<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND}/api${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
      // An API that is down (or absent, as in a frontend-only build) answers null quickly.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    const env = (await res.json()) as ApiResponse<T>;
    return env.data ?? null;
  } catch {
    return null;
  }
}
