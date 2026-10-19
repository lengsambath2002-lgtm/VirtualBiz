'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { isNotFound } from '@/components/feedback';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';

import type {
  AuditEntry,
  OrderDetail,
  OrderRow,
  Overview,
  Page,
  Payout,
  PayoutBalance,
  PlatformPromo,
  PlatformRole,
  PromoInput,
  ReviewRow,
  ShopDetail,
  ShopRow,
  UserDetail,
  UserRow,
} from './types';

// `/api/admin/**` (docs/api/phase7-admin.md). Every key starts with 'admin' so one invalidation
// refreshes the console after an action.

export type Params = Record<string, string | number | undefined | null>;

/** `?a=1&b=x` from the set values (empty strings and nulls left out). */
export function qs(p: Params): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p))
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

function useAdminQuery<T>(key: QueryKey, path: string, enabled = true) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['admin', user?.id, ...key],
    queryFn: () => api.get<T>(`/admin${path}`),
    enabled: enabled && !!user?.platformRole,
    placeholderData: keepPreviousData,
    // A missing shop / user / order is final; other failures get one more try.
    retry: (n, e) => !isNotFound(e) && n < 1,
  });
}

export const useOverview = () => useAdminQuery<Overview>(['overview'], '/overview');

export const useShops = (p: Params) =>
  useAdminQuery<Page<ShopRow>>(['shops', p], `/businesses${qs(p)}`);
export const useShop = (id: string) => useAdminQuery<ShopDetail>(['shop', id], `/businesses/${id}`);
export const useIdPhoto = (id: string, enabled: boolean) =>
  useAdminQuery<{ contentType: string; size: number; dataUrl: string; uploadedAt: string }>(
    ['idPhoto', id],
    `/businesses/${id}/id-photo`,
    enabled,
  );

export const useUsers = (p: Params) => useAdminQuery<Page<UserRow>>(['users', p], `/users${qs(p)}`);
export const useUser = (id: string) => useAdminQuery<UserDetail>(['user', id], `/users/${id}`);

export const useOrders = (p: Params) =>
  useAdminQuery<Page<OrderRow>>(['orders', p], `/orders${qs(p)}`);
export const useOrder = (number: string) =>
  useAdminQuery<OrderDetail>(['order', number], `/orders/${encodeURIComponent(number)}`);

export const useReviews = (p: Params) =>
  useAdminQuery<Page<ReviewRow>>(['reviews', p], `/reviews${qs(p)}`);

export const usePromos = () => useAdminQuery<PlatformPromo[]>(['promos'], '/promotions');

export const useBalances = () => useAdminQuery<PayoutBalance[]>(['balances'], '/payouts/balances');
export const usePayouts = (p: Params) =>
  useAdminQuery<Page<Payout>>(['payouts', p], `/payouts${qs(p)}`);

export const useAudit = (p: Params) =>
  useAdminQuery<Page<AuditEntry>>(['audit', p], `/audit${qs(p)}`);

/** An admin action: refreshes every console query when it succeeds. */
export function useAdminAction<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export const adminApi = {
  verify: (id: string, reason?: string) =>
    api.post<ShopDetail>(`/admin/businesses/${id}/verify`, reason ? { reason } : {}),
  reject: (id: string, reason: string) =>
    api.post<ShopDetail>(`/admin/businesses/${id}/reject`, { reason }),
  suspendShop: (id: string, reason: string) =>
    api.post<ShopDetail>(`/admin/businesses/${id}/suspend`, { reason }),
  reinstateShop: (id: string, reason?: string) =>
    api.post<ShopDetail>(`/admin/businesses/${id}/reinstate`, reason ? { reason } : {}),
  suspendUser: (id: string, reason: string) =>
    api.post<UserDetail>(`/admin/users/${id}/suspend`, { reason }),
  reinstateUser: (id: string, reason?: string) =>
    api.post<UserDetail>(`/admin/users/${id}/reinstate`, reason ? { reason } : {}),
  signOutUser: (id: string, reason?: string) =>
    api.post<UserDetail>(`/admin/users/${id}/sign-out`, reason ? { reason } : {}),
  setRole: (id: string, role: PlatformRole | null) =>
    api.put<UserDetail>(`/admin/users/${id}/role`, { role }),
  cancelOrder: (number: string, reason: string) =>
    api.post<OrderDetail>(`/admin/orders/${encodeURIComponent(number)}/cancel`, { reason }),
  refundOrder: (number: string, reason: string, restock: boolean) =>
    api.post<OrderDetail>(`/admin/orders/${encodeURIComponent(number)}/refund`, {
      reason,
      restock,
    }),
  hideReview: (id: string, reason: string) =>
    api.post<ReviewRow>(`/admin/reviews/${id}/hide`, { reason }),
  restoreReview: (id: string) => api.post<ReviewRow>(`/admin/reviews/${id}/restore`, {}),
  createPromo: (input: PromoInput) => api.post<PlatformPromo>('/admin/promotions', input),
  updatePromo: (id: string, input: PromoInput) =>
    api.patch<PlatformPromo>(`/admin/promotions/${id}`, input),
  endPromo: (id: string) => api.post<PlatformPromo>(`/admin/promotions/${id}/end`, {}),
  pay: (businessId: string, reference: string, note?: string) =>
    api.post<Payout>('/admin/payouts', { businessId, reference, ...(note ? { note } : {}) }),
};
