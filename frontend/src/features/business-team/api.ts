'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type ApiMember } from '@/lib/api';
import type { MemberRole } from '@/lib/domain';

// A shop's team and invites (docs/api/phase10-shop-team.md). Every call names the business.

export interface TeamInvite {
  id: string;
  email: string;
  name: string;
  role: Exclude<MemberRole, 'OWNER'>;
  memberId?: string | null;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  devLink?: string | null;
}

const opts = (businessId: string) => ({ businessId });
export const teamKey = (businessId: string) => ['team', businessId];

export function useTeam(businessId: string) {
  return useQuery({
    queryKey: [...teamKey(businessId), 'members'],
    queryFn: () => api.get<ApiMember[]>(`/businesses/${businessId}/members`, opts(businessId)),
  });
}

export function useTeamInvites(businessId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...teamKey(businessId), 'invites'],
    queryFn: () => api.get<TeamInvite[]>(`/businesses/${businessId}/invites`, opts(businessId)),
    enabled,
  });
}

/** Refresh the team and invites after a change. */
export function useTeamRefresh(businessId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: teamKey(businessId) });
}

export const teamApi = {
  invite: (
    businessId: string,
    input: { email: string; name?: string; role: TeamInvite['role']; memberId?: string },
  ) => api.post<TeamInvite>(`/businesses/${businessId}/invites`, input, opts(businessId)),
  revoke: (businessId: string, id: string) =>
    api.delete<TeamInvite[]>(`/businesses/${businessId}/invites/${id}`, opts(businessId)),
  patch: (
    businessId: string,
    memberId: string,
    input: { role?: TeamInvite['role']; active?: boolean },
  ) =>
    api.patch<ApiMember>(`/businesses/${businessId}/members/${memberId}`, input, opts(businessId)),
};
