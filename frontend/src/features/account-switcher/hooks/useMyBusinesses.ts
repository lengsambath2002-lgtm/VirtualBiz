'use client';

import { useQuery } from '@tanstack/react-query';

import { api, type MyBusiness } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { BusinessType } from '@/lib/domain';

/** Where each business type's workspace lives. */
export const WORKSPACE_HREF: Record<BusinessType, '/seller' | '/provider'> = {
  PRODUCT: '/seller',
  SERVICE: '/provider',
};

/** Query key of the signed-in user's businesses (invalidate after creating one). */
export const myBusinessesKey = (userId: string | undefined) =>
  ['me', userId, 'businesses'] as const;

/** The businesses the signed-in user can switch into: `GET /api/me/businesses`. */
export function useMyBusinesses() {
  const { user } = useSession();
  return useQuery({
    queryKey: myBusinessesKey(user?.id),
    queryFn: () => api.get<MyBusiness[]>('/me/businesses'),
    enabled: !!user,
    staleTime: 60_000,
  });
}
