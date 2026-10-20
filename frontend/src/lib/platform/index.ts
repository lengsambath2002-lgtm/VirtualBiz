'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

/** `GET /api/meta/settings`: the platform numbers a super-admin sets from the console. */
export interface PlatformSettings {
  commissionPct: number;
  payoutDelayDays: number;
  khrPerUsd: number;
}

/** Shown until the settings load (the values VirtualBiz launched with). */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  commissionPct: 5,
  payoutDelayDays: 1,
  khrPerUsd: 4100,
};

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
