'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type ApiNotification } from '@/lib/api';
import { useSession } from '@/lib/auth';

// The customer's inbox (docs/api/phase3-orders-checkout.md § Notifications). The live stream
// invalidates it when a new entry arrives.

export const notificationsKey = (userId: string | undefined) =>
  ['me', userId, 'notifications'] as const;

/** `GET /api/me/notifications` (empty when signed out). */
export function useMyNotifications() {
  const { user } = useSession();
  return useQuery({
    queryKey: notificationsKey(user?.id),
    queryFn: () => api.get<ApiNotification[]>('/me/notifications'),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/** Mark one entry read (optimistic). */
export function useReadNotification() {
  const qc = useQueryClient();
  const { user } = useSession();
  const key = notificationsKey(user?.id);
  return useMutation({
    mutationFn: (id: string) => api.post<ApiNotification>(`/me/notifications/${id}/read`),
    onMutate: (id) =>
      qc.setQueryData<ApiNotification[]>(key, (list) =>
        list?.map((n) => (n.id === id ? { ...n, unread: false } : n)),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Mark every entry read (optimistic). */
export function useReadAllNotifications() {
  const qc = useQueryClient();
  const { user } = useSession();
  const key = notificationsKey(user?.id);
  return useMutation({
    mutationFn: () => api.post<void>('/me/notifications/read-all'),
    onMutate: () =>
      qc.setQueryData<ApiNotification[]>(key, (list) =>
        list?.map((n) => ({ ...n, unread: false })),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
