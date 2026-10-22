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
  CategoryRequest,
  AdminCategory,
  AuditEntry,
  CategoryInput,
  OrderDetail,
  OrderRow,
  Overview,
  OverviewRange,
  Page,
  Payout,
  PayoutBalance,
  PlatformPromo,
  PlatformRole,
  PlatformSettings,
  PromoInput,
  ReviewRow,
  ShopDetail,
  ShopRow,
  StaffInvite,
  StaffMember,
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

function useAdminQuery<T>(key: QueryKey, path: string, enabled = true, refetchInterval?: number) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['admin', user?.id, ...key],
    queryFn: () => api.get<T>(`/admin${path}`),
    enabled: enabled && !!user?.platformRole,
    placeholderData: keepPreviousData,
    ...(refetchInterval ? { refetchInterval } : {}),
    // A missing shop / user / order is final; other failures get one more try.
    retry: (n, e) => !isNotFound(e) && n < 1,
  });
}

/** The overview (and the rail's queue badges): refreshed every minute while open. */
export const useOverview = (days: OverviewRange = 30) =>
  useAdminQuery<Overview>(['overview', days], `/overview?days=${days}`, true, 60_000);

export const useSettings = () => useAdminQuery<PlatformSettings>(['settings'], '/settings');
export const useStaff = () => useAdminQuery<StaffMember[]>(['staff'], '/staff');
export const useStaffInvites = () =>
  useAdminQuery<StaffInvite[]>(['staffInvites'], '/staff/invites');
export const useCategories = () => useAdminQuery<AdminCategory[]>(['categories'], '/categories');
/** Shops' category suggestions waiting for a decision. */
export const useCategoryRequests = (page = 0, size = 10) =>
  useAdminQuery<Page<CategoryRequest>>(
    ['categoryRequests', page, size],
    `/category-requests?page=${page}&size=${size}`,
  );

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

export const usePromos = (p: Params) =>
  useAdminQuery<Page<PlatformPromo>>(['promos', p], `/promotions${qs(p)}`);

export const useBalances = (p: Params) =>
  useAdminQuery<Page<PayoutBalance>>(['balances', p], `/payouts/balances${qs(p)}`);
export const usePayoutSummary = () =>
  useAdminQuery<{ payable: number; onHold: number; shopsDue: number }>(
    ['payoutSummary'],
    '/payouts/summary',
  );
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

/** What a bulk action did: rows it refused come back with the reason code. */
export interface BulkResult {
  done: number;
  failed: { id: string; code: string; message: string }[];
}
export type BulkList = 'businesses' | 'users' | 'reviews';

export const adminApi = {
  approveCategoryRequest: (
    id: string,
    body: { categoryId?: string; name?: string; nameKh?: string; moveShop: boolean },
  ) => api.post(`/admin/category-requests/${id}/approve`, body),
  rejectCategoryRequest: (id: string, reason: string) =>
    api.post(`/admin/category-requests/${id}/reject`, { reason }),
  bulk: (list: BulkList, ids: string[], action: string, reason?: string) =>
    api.post<BulkResult>(`/admin/${list}/bulk`, { ids, action, ...(reason ? { reason } : {}) }),
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
  updateSettings: (s: Pick<PlatformSettings, 'commissionPct' | 'payoutDelayDays' | 'khrPerUsd'>) =>
    api.put<PlatformSettings>('/admin/settings', s),
  createCategory: (input: CategoryInput) => api.post<AdminCategory>('/admin/categories', input),
  updateCategory: (id: string, input: CategoryInput) =>
    api.patch<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, input),
  reorderCategories: (ids: string[]) => api.put<AdminCategory[]>('/admin/categories/order', ids),
  inviteStaff: (input: { email: string; name: string; role: PlatformRole }) =>
    api.post<StaffInvite>('/admin/staff/invites', input),
  revokeInvite: (id: string) => api.delete<StaffInvite[]>(`/admin/staff/invites/${id}`),
  resetMfa: (id: string, reason: string) =>
    api.post<StaffMember[]>(`/admin/staff/${id}/mfa/reset`, { reason }),
  pay: (businessId: string, reference: string, note?: string) =>
    api.post<Payout>('/admin/payouts', { businessId, reference, ...(note ? { note } : {}) }),
};
