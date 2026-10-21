'use client';

import { useQuery } from '@tanstack/react-query';

import { api, type ApiDistrict } from '@/lib/api';

/** Phnom Penh's districts in display order (cached for an hour; shared by every screen). */
export const useDistricts = () =>
  useQuery({
    queryKey: ['meta', 'districts'],
    queryFn: () => api.get<ApiDistrict[]>('/meta/districts', { auth: false }),
    staleTime: 60 * 60_000,
  });
