'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Business } from '@/lib/domain';

/** A shop's balance with VirtualBiz and its latest payouts (`GET /api/payouts`). */
export interface ShopPayouts {
  balance: {
    payments: number;
    released: number;
    commission: number;
    takenBack: number;
    payable: number;
    onHold: number;
    lastPayoutAt?: string;
  } | null;
  payouts: {
    id: string;
    amount: number;
    gross: number;
    commission: number;
    payments: number;
    bakongId: string;
    reference: string;
    paidAt: string;
  }[];
  releaseDays: number;
  commissionPct: number;
}

/** The workspace's business (same cache entry as the workspace bootstrap). */
export const useBusinessStatus = (id: string | undefined) =>
  useQuery({
    queryKey: ['business', id],
    queryFn: () => api.get<Business>(`/businesses/${id}`, { businessId: id! }),
    enabled: !!id,
    staleTime: 60_000,
  });

export const useShopPayouts = (id: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ['payouts', id],
    queryFn: () => api.get<ShopPayouts>('/payouts', { businessId: id! }),
    enabled: !!id && enabled,
  });

/** Sends a new ID photo (data URL); the shop goes back to "checking". */
export function useResubmitId(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idPhoto: string) =>
      api.patch<Business>(`/businesses/${id}`, { idPhoto }, { businessId: id! }),
    onSuccess: (b) => qc.setQueryData(['business', id], b),
  });
}
