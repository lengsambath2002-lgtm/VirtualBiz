// Business Platform sign-in and shop links (docs/api/platform-sso.md).
import { api, apiFetch } from '@/lib/api';

import type { PlatformIntent, PlatformRoute, PlatformSession, ShopPlatformLink } from './types';

/** The platform's authorize URL for a new sign-in (sets the browser binding cookie). */
export const startPlatform = (input: {
  intent: PlatformIntent;
  businessId?: string;
  orgId?: string;
  next?: string;
}) =>
  apiFetch<{ authorizeUrl: string }>('/auth/platform/start', {
    method: 'POST',
    body: input,
    auth: false,
  });

/**
 * Finishes the sign-in with what the platform sent back. Errors: INVALID_TOKEN, LINK_REQUIRED
 * (`meta.ticket`, `meta.email`, `meta.name`), TWO_STEP_REQUIRED (`meta.ticket`, `meta.route`),
 * ACCOUNT_SUSPENDED, NOT_CONFIGURED, PLATFORM_UNAVAILABLE.
 */
export const completePlatform = (code: string, state: string) =>
  apiFetch<PlatformSession>('/auth/platform/complete', {
    method: 'POST',
    body: { code, state },
    auth: false,
  });

/** Signed in as the account LINK_REQUIRED named: link it. Errors: FORBIDDEN (WRONG_ACCOUNT), CONFLICT, INVALID_TOKEN. */
export const linkPlatform = (ticket: string) =>
  api.post<PlatformRoute>('/auth/platform/link', { ticket });

export const shopPlatformLink = (businessId: string) =>
  api.get<ShopPlatformLink>(`/businesses/${businessId}/platform`, { businessId });

/** Owner only. Errors: FORBIDDEN (`meta.reason` NOT_OWNER | NOT_LINKED | SIGN_IN_AGAIN | NOT_ORG_ADMIN | PLATFORM_FORBIDDEN). */
export const connectShop = (businessId: string, orgId: string) =>
  api.post<ShopPlatformLink>(
    `/businesses/${businessId}/platform/connect`,
    { orgId },
    { businessId },
  );

export const disconnectShop = (businessId: string) =>
  api.delete<ShopPlatformLink>(`/businesses/${businessId}/platform/connect`, { businessId });
