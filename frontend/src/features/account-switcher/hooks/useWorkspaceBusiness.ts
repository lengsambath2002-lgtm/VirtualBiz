'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { Business, BusinessType } from '@/lib/domain';
import { useRouter } from '@/lib/i18n/navigation';
import { pickActiveBusiness } from '@/lib/workspace';

import { useMyBusinesses } from './useMyBusinesses';

export interface WorkspaceBusiness {
  /** The open business (`GET /api/businesses/{id}`), once loaded. */
  business: Business | null;
  error: unknown;
}

/**
 * The business a workspace opens: the last one opened if the user is still a member, else
 * their first of this type. Someone with no business of this type is sent to Create Business.
 */
export function useWorkspaceBusiness(type: BusinessType): WorkspaceBusiness {
  const { user, ready } = useSession();
  const router = useRouter();
  const list = useMyBusinesses();
  const picked = list.data ? pickActiveBusiness(type, list.data) : null;
  const none = !!list.data && !picked;

  useEffect(() => {
    if (ready && user && none) router.replace('/create-business');
  }, [ready, user, none, router]);

  const q = useQuery({
    queryKey: ['business', picked?.id],
    queryFn: () => api.get<Business>(`/businesses/${picked!.id}`, { businessId: picked!.id }),
    enabled: !!picked,
    staleTime: 60_000,
  });

  const business = q.data ?? null;
  return {
    business,
    error: list.error ?? q.error,
  };
}
