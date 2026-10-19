'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { api, fallbackErrorKey, type SavedEntry } from '@/lib/api';
import { useSession } from '@/lib/auth';

import { toast } from './store';

// Saved items and followed shops (`/api/me/saved`). Keys are a listing slug (`latte`) or
// `shop:` + a shop slug (`shop:happy-coffee`), as the screens always used.

export const savedKey = (userId: string | undefined) => ['me', userId, 'saved'] as const;

/** The signed-in user's saved keys, newest first (empty while signed out). */
export function useSavedKeys(): string[] {
  const { user } = useSession();
  const q = useQuery({
    queryKey: savedKey(user?.id),
    queryFn: () => api.get<SavedEntry[]>('/me/saved'),
    enabled: !!user,
  });
  return useMemo(() => (user ? (q.data ?? []).map((e) => e.key) : []), [user, q.data]);
}

/** Whether the saved list failed to load (with nothing cached), and a retry. */
export function useSavedLoad() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: savedKey(user?.id),
    queryFn: () => api.get<SavedEntry[]>('/me/saved'),
    enabled: !!user,
  });
  return { error: q.data ? null : q.error, retry: () => void q.refetch() };
}

export const useIsSaved = (key: string) => useSavedKeys().includes(key);

/**
 * `toggle(key)` saves or unsaves at once (optimistic) and returns the new state; the API call
 * follows (`PUT` / `DELETE /api/me/saved/{key}`) and a failure puts the heart back.
 */
export function useToggleSavedKey() {
  const qc = useQueryClient();
  const { user } = useSession();
  const tc = useTranslations('common');
  const key = savedKey(user?.id);
  const m = useMutation({
    mutationFn: ({ k, on }: { k: string; on: boolean }) =>
      on
        ? api.put<SavedEntry[]>(`/me/saved/${encodeURIComponent(k)}`)
        : api.delete<SavedEntry[]>(`/me/saved/${encodeURIComponent(k)}`),
    onMutate: async ({ k, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SavedEntry[]>(key);
      const rest = (prev ?? []).filter((e) => e.key !== k);
      const entry: SavedEntry = {
        key: k,
        type: k.startsWith('shop:') ? 'SHOP' : 'PRODUCT',
        id: '',
        savedAt: new Date().toISOString(),
      };
      qc.setQueryData<SavedEntry[]>(key, on ? [entry, ...rest] : rest);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast(tc(fallbackErrorKey(e)));
    },
    onSuccess: (list) => qc.setQueryData(key, list),
  });
  return useCallback(
    (k: string) => {
      const was = (qc.getQueryData<SavedEntry[]>(key) ?? []).some((e) => e.key === k);
      m.mutate({ k, on: !was });
      return !was;
    },
    [qc, key, m],
  );
}
