'use client';

import type { MemberRole } from '@/lib/domain';

import { useMyBusinesses } from './useMyBusinesses';

/**
 * The signed-in person's role in a business (docs/api/phase10-shop-team.md § Permissions), for
 * hiding what the backend would refuse. Null while loading or when not a member.
 */
export function useMyRole(businessId: string | null | undefined): MemberRole | null {
  const { data } = useMyBusinesses();
  return data?.find((b) => b.id === businessId)?.role ?? null;
}
