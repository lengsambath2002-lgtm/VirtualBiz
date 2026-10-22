'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from './settings';

export { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings };

/** The platform settings (public, cached for 5 minutes). Never undefined: defaults until loaded. */
export function usePlatformSettings(): PlatformSettings {
  const { data } = useQuery({
    queryKey: ['meta', 'settings'],
    queryFn: () => api.get<PlatformSettings>('/meta/settings', { auth: false }),
    staleTime: 5 * 60_000,
  });
  return data
    ? {
        commissionPct: Number(data.commissionPct),
        payoutDelayDays: data.payoutDelayDays,
        khrPerUsd: data.khrPerUsd,
      }
    : DEFAULT_PLATFORM_SETTINGS;
}
