// Plain values (no 'use client'), so server components can read them too.

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
