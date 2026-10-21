'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api, type ApiAvailability, type ApiBooking, type BookingInput } from '@/lib/api';
import { useSession } from '@/lib/auth';

import type { ShopBooking } from '@/features/shop-shared/types';

// The customer's bookings and a service's free times (docs/api/phase4-bookings-provider.md
// § Customer). Booking keys start with the user id; the live stream invalidates them.

export const bookingsKey = (userId: string | undefined) => ['me', userId, 'bookings'] as const;
export const availabilityKey = (slug: string, from: string, staffId: string) =>
  ['availability', slug, from, staffId] as const;

/** `YYYY-MM-DD` of a local date (the customer is in Phnom Penh). */
export const isoOfLocal = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Local midnight (ms) of a `YYYY-MM-DD` date. */
const msOfIso = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** API booking → the customer screens' shape (slugs as ids, local-midnight dates). */
export const toShopBooking = (b: ApiBooking): ShopBooking => ({
  id: b.id,
  number: b.number,
  serviceId: b.service.slug,
  businessId: b.shop.slug,
  staffId: b.staff?.id ?? null,
  date: msOfIso(b.date),
  start: b.start,
  durationMin: b.durationMin,
  price: b.price,
  status: b.status,
  ...(b.rescheduled ? { rescheduled: true } : {}),
  ...(b.note ? { note: b.note } : {}),
  ...(b.cancelReason ? { cancelReason: b.cancelReason } : {}),
  ...(b.declineMessage ? { declineMessage: b.declineMessage } : {}),
  canChange: b.canChange,
  freeCancelUntil: Date.parse(b.freeCancelUntil),
});

/** The signed-in customer's bookings (upcoming first); empty for a guest. */
export function useMyBookings() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: bookingsKey(user?.id),
    queryFn: async () => (await api.get<ApiBooking[]>('/me/bookings')).map(toShopBooking),
    enabled: !!user,
    staleTime: 30_000,
  });
  return {
    bookings: q.data ?? [],
    loading: !!user && q.isLoading,
    // Only a load that left nothing to show counts as failed (a background refresh may fail).
    error: q.data ? null : q.error,
    retry: () => void q.refetch(),
  };
}

export async function bookService(input: BookingInput) {
  return toShopBooking(await api.post<ApiBooking>('/me/bookings', input));
}

export async function cancelBooking(number: string) {
  return toShopBooking(await api.post<ApiBooking>(`/me/bookings/${number}/cancel`));
}

/** Put a booking the API returned into the cached list. */
export function putBooking(qc: QueryClient, userId: string | undefined, b: ShopBooking) {
  qc.setQueryData<ShopBooking[]>(bookingsKey(userId), (list) =>
    list ? [b, ...list.filter((x) => x.number !== b.number)] : [b],
  );
  void qc.invalidateQueries({ queryKey: bookingsKey(userId) });
}

/** Free times for `days` days from `from` (`staffId` empty = anyone). */
export function useAvailability(slug: string, from: string, staffId: string, days = 7) {
  return useQuery({
    queryKey: availabilityKey(slug, from, staffId),
    queryFn: () =>
      api.get<ApiAvailability>(
        `/marketplace/items/${encodeURIComponent(slug)}/availability?from=${from}&days=${days}` +
          (staffId ? `&staffId=${staffId}` : ''),
      ),
    staleTime: 15_000,
  });
}

export function useBookingsClient() {
  const qc = useQueryClient();
  const { user } = useSession();
  return { qc, userId: user?.id };
}
