'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type ApiDistrict, type CreateBusinessInput } from '@/lib/api';
import type { Business, BusinessType } from '@/lib/domain';

import { onboardingCategories } from './categories';
import type { DraftBusinessType } from './types';

export function useDistricts() {
  return useQuery({
    queryKey: ['meta', 'districts'],
    queryFn: () => api.get<ApiDistrict[]>('/meta/districts', { auth: false }),
    staleTime: Infinity,
  });
}

const TYPE: Record<DraftBusinessType, BusinessType> = { product: 'PRODUCT', service: 'SERVICE' };

/** The chips for the chosen business type (static: the prototype's list, see `categories.ts`). */
export function useOnboardingCategories(type: DraftBusinessType | '') {
  return { data: type === '' ? undefined : onboardingCategories(TYPE[type]) };
}

/** "Open my shop": `POST /api/businesses` (the creator becomes OWNER). */
export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBusinessInput) => api.post<Business>('/businesses', input),
    // The switcher lists the new business right away.
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'me' && q.queryKey[2] === 'businesses',
      }),
  });
}
