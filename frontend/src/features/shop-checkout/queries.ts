'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  api,
  type CheckoutInput,
  type CheckoutResult,
  type PaymentIntent,
  type Quote,
} from '@/lib/api';

import { variantIdOf } from '@/features/shop-cart/queries';
import type { CartLine, Item } from '@/features/shop-shared/types';

// Checkout and payments (docs/api/phase3-orders-checkout.md § Checkout, § Payments). Every
// total the customer sees is the server's quote.

/** The selected cart lines as checkout lines (variant + quantity). */
export function checkoutLines(cart: CartLine[], item: (id: string) => Item | undefined) {
  return cart.flatMap((l) => {
    const variantId = l.on ? variantIdOf(l, item) : undefined;
    return variantId ? [{ variantId, qty: l.qty }] : [];
  });
}

export const quote = (input: CheckoutInput) => api.post<Quote>('/checkout/quote', input);

/** `POST /api/checkout/quote` for the current cart / checkout form (keeps the last answer while refetching). */
export function useQuote(input: CheckoutInput | null) {
  return useQuery({
    queryKey: ['shop', 'quote', input],
    queryFn: () => quote(input!),
    enabled: !!input && input.lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

/** `POST /api/checkout` with the attempt's idempotency key. */
export const placeCheckout = (input: CheckoutInput, idempotencyKey: string) =>
  api.post<CheckoutResult>('/checkout', input, { headers: { 'Idempotency-Key': idempotencyKey } });

export const getPayment = (id: string) => api.get<PaymentIntent>(`/me/payments/${id}`);
export const cancelPayment = (id: string) => api.post<PaymentIntent>(`/me/payments/${id}/cancel`);
/** LOCAL SIMULATOR: the bank confirms the KHQR transfer (local / dev API only). */
export const simulatePayment = (id: string) =>
  api.post<PaymentIntent>(`/me/payments/${id}/simulate`);

/** A random key for one checkout attempt (reused when the same attempt is retried). */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
