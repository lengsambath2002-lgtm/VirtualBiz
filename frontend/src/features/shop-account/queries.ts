'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api, type AddressInput, type ApiAddress, type Me, type Prefs } from '@/lib/api';
import { useSession, useSessionStore } from '@/lib/auth';
import type { User } from '@/lib/domain';

import type { ShopAddress } from '@/features/shop-shared/types';

// Account endpoints (`/api/me/**`). Keys start with the user id, so another account never
// sees a cached answer.

export const meKey = (userId: string | undefined) => ['me', userId] as const;
export const addressesKey = (userId: string | undefined) => ['me', userId, 'addresses'] as const;

/** API address → the shape the shop screens use (no nulls). */
export function toShopAddress(a: ApiAddress): ShopAddress {
  return {
    id: a.id,
    label: a.label,
    name: a.name,
    phone: a.phone,
    line: a.line,
    district: a.district,
    ...(a.note ? { note: a.note } : {}),
    ...(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : {}),
    isDefault: a.isDefault,
  };
}

const listAddresses = async () => (await api.get<ApiAddress[]>('/me/addresses')).map(toShopAddress);

/** `GET /api/me`: the user plus notification prefs. */
export function useMe() {
  const { user } = useSession();
  return useQuery({
    queryKey: meKey(user?.id),
    queryFn: () => api.get<Me>('/me'),
    enabled: !!user,
  });
}

/**
 * `PATCH /api/me` ({name, phone, avatarUrl, coverUrl}; an empty photo URL removes it); the
 * session's user follows.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; phone?: string; avatarUrl?: string; coverUrl?: string }) =>
      api.patch<User>('/me', patch),
    onSuccess: (res) => {
      // A removed photo is absent from the answer: clear it rather than keep the old one.
      const user = { ...res, avatarUrl: res.avatarUrl, coverUrl: res.coverUrl };
      useSessionStore.getState().updateUser(user);
      qc.setQueryData<Me>(meKey(user.id), (me) => (me ? { ...me, ...user } : me));
    },
  });
}

/** `PUT /api/me/prefs`, optimistic (the switch flips at once, and back on failure). */
export function useSetPrefs() {
  const qc = useQueryClient();
  const { user } = useSession();
  const key = meKey(user?.id);
  return useMutation({
    mutationFn: (prefs: Prefs) => api.put<Prefs>('/me/prefs', prefs),
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Me>(key);
      if (prev) qc.setQueryData<Me>(key, { ...prev, prefs });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (prefs) => qc.setQueryData<Me>(key, (me) => (me ? { ...me, prefs } : me)),
  });
}

/** `POST /api/me/password`. Errors: INVALID_CREDENTIALS (currentPassword), VALIDATION_FAILED. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post<void>('/me/password', body),
  });
}

// ---- addresses ------------------------------------------------------------------------

/** The signed-in user's saved addresses (`GET /api/me/addresses`); empty while signed out. */
export function useAddresses() {
  const { user } = useSession();
  return useQuery({
    queryKey: addressesKey(user?.id),
    queryFn: listAddresses,
    enabled: !!user,
  });
}

/** Addresses for code outside React (e.g. after the login sheet): cached or fetched. */
export function fetchAddresses(qc: QueryClient): Promise<ShopAddress[]> {
  const id = useSessionStore.getState().user?.id;
  if (!id) return Promise.resolve([]);
  return qc.ensureQueryData({ queryKey: addressesKey(id), queryFn: listAddresses });
}

const toInput = (a: Omit<ShopAddress, 'id'>): AddressInput => ({
  label: a.label,
  name: a.name,
  phone: a.phone,
  line: a.line,
  district: a.district,
  ...(a.note ? { note: a.note } : {}),
  ...(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : {}),
  isDefault: a.isDefault,
});

function useAddressMutation<V, R extends ShopAddress[] | ShopAddress>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  const { user } = useSession();
  const key = addressesKey(user?.id);
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      // List answers replace the cache; a single address needs the list again (defaults move).
      if (Array.isArray(res)) return qc.setQueryData(key, res);
      const one = res as ShopAddress;
      qc.setQueryData<ShopAddress[]>(key, (list = []) => [
        ...list
          .filter((x) => x.id !== one.id)
          .map((x) => (one.isDefault ? { ...x, isDefault: false } : x)),
        one,
      ]);
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** `POST /api/me/addresses` (the first address is always the default). */
export function useAddAddress() {
  return useAddressMutation(async (a: Omit<ShopAddress, 'id'>) =>
    toShopAddress(await api.post<ApiAddress>('/me/addresses', toInput(a))),
  );
}

/** `POST /api/me/addresses/{id}/default`. */
export function useSetDefaultAddress() {
  return useAddressMutation(async (id: string) =>
    (await api.post<ApiAddress[]>(`/me/addresses/${encodeURIComponent(id)}/default`)).map(
      toShopAddress,
    ),
  );
}

/** `DELETE /api/me/addresses/{id}` (the next one becomes default if the default goes). */
export function useDeleteAddress() {
  return useAddressMutation(async (id: string) =>
    (await api.delete<ApiAddress[]>(`/me/addresses/${encodeURIComponent(id)}`)).map(toShopAddress),
  );
}
