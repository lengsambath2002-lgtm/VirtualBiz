'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';

// Staff sign-in security (docs/api/phase9-staff-security.md).

export interface StaffSecurity {
  staff: boolean;
  mustChangePassword: boolean;
  mfaRequired: boolean;
  enrolled: boolean;
  verified: boolean;
  verifiedUntil?: string;
  recoveryCodesLeft: number;
}

/** Codes the admin API answers with while a step is missing (the gate shows that step). */
export const GATE_CODES = ['PASSWORD_CHANGE_REQUIRED', 'MFA_SETUP_REQUIRED', 'MFA_REQUIRED'];

export const securityKey = (userId?: string) => ['staff-security', userId];

export function useStaffSecurity() {
  const { user } = useSession();
  return useQuery({
    queryKey: securityKey(user?.id),
    queryFn: () => api.get<StaffSecurity>('/staff/security'),
    enabled: !!user?.platformRole,
    staleTime: 30_000,
  });
}

export const securityApi = {
  setup: () => api.post<{ secret: string; otpauthUri: string }>('/staff/security/mfa/setup', {}),
  enable: (code: string) => api.post<{ codes: string[] }>('/staff/security/mfa/enable', { code }),
  verify: (input: { code?: string; recoveryCode?: string }) =>
    api.post<StaffSecurity>('/staff/security/mfa/verify', input),
  regenerate: () => api.post<{ codes: string[] }>('/staff/security/mfa/recovery-codes', {}),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/me/password', { currentPassword, newPassword }),
};

/** Staff password rules (backend PasswordPolicy with staff = true). */
export const STAFF_RULES: readonly ['staffLen' | 'case' | 'num' | 'sym', (v: string) => boolean][] =
  [
    ['staffLen', (v) => v.length >= 12 && v.length <= 72],
    ['case', (v) => /[a-z]/.test(v) && /[A-Z]/.test(v)],
    ['num', (v) => /\d/.test(v)],
    ['sym', (v) => /[^A-Za-z0-9]/.test(v)],
  ];
export const staffPasswordOk = (v: string, email = '') =>
  STAFF_RULES.every(([, ok]) => ok(v)) &&
  !(email && v.toLowerCase().includes(email.split('@')[0]!.toLowerCase()));
