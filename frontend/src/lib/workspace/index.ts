// Which business each workspace opened last: a client preference, so it lives in localStorage.
// The list of businesses itself comes from the API (`GET /api/me/businesses`).
import type { BusinessType } from '@/lib/domain';

const ACTIVE_KEY = 'vb-active-business';

function readActive(): Partial<Record<BusinessType, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<BusinessType, string>>) : {};
  } catch {
    return {};
  }
}

/** Business the workspace of this type opened last (null when none was chosen yet). */
export function activeBusinessId(type: BusinessType): string | null {
  return readActive()[type] ?? null;
}

export function setActiveBusiness(type: BusinessType, id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...readActive(), [type]: id }));
  } catch {
    /* blocked storage: the workspace falls back to the first business */
  }
}

/**
 * Pick the business a workspace opens: the last one opened if the user is still a member,
 * otherwise their first business of that type (null when they have none).
 */
export function pickActiveBusiness<T extends { id: string; type: BusinessType }>(
  type: BusinessType,
  businesses: readonly T[],
): T | null {
  const own = businesses.filter((b) => b.type === type);
  const last = activeBusinessId(type);
  return own.find((b) => b.id === last) ?? own[0] ?? null;
}

/** localStorage key of a workspace's saved state (one per business). */
export const workspaceKey = (base: 'vb-seller' | 'vb-provider', id: string) => `${base}:${id}`;
