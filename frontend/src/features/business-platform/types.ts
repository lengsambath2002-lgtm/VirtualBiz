import type { AuthSession } from '@/lib/api';
import type { BusinessType, MemberRole } from '@/lib/domain';

/** Why a platform sign-in was started: sign in, open a shop, or connect a shop to an organisation. */
export type PlatformIntent = 'signin' | 'open' | 'connect';

/** An organisation from the platform's ID token, with the person's role in it. */
export interface PlatformOrg {
  id: string;
  slug?: string | null;
  name?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' | string;
}

/** Where to go after a platform sign-in (docs/api/platform-sso.md). */
export interface PlatformRoute {
  intent: PlatformIntent;
  businessId?: string | null;
  orgId?: string | null;
  next?: string | null;
  orgs?: PlatformOrg[];
  /** The shop to open, when the person can open it. */
  business?: { id: string; name: string; type: BusinessType; role: MemberRole } | null;
}

/** `POST /api/auth/platform/complete`: the usual session plus the route. */
export type PlatformSession = AuthSession & PlatformRoute;

/** `GET /api/businesses/{id}/platform`. */
export interface ShopPlatformLink {
  available: boolean;
  linked: boolean;
  orgId?: string | null;
  orgName?: string | null;
  linkedAt?: string | null;
  canManage: boolean;
}

/** A LINK_REQUIRED answer, kept while the person signs in to their VirtualBiz account. */
export interface PendingLink {
  ticket: string;
  /** Masked: `d***@gmail.com`. */
  email: string;
  name: string;
}

export const manages = (o: PlatformOrg) => o.role === 'OWNER' || o.role === 'ADMIN';
