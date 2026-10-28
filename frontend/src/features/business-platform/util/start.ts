import { startPlatform } from '../api';
import type { PlatformIntent } from '../types';

/** Starts a platform sign-in and leaves for the platform's authorize page. Throws ApiError. */
export async function goToPlatform(input: {
  intent: PlatformIntent;
  businessId?: string;
  orgId?: string;
  next?: string;
}) {
  const { authorizeUrl } = await startPlatform(input);
  window.location.assign(authorizeUrl);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | null | undefined): s is string => !!s && UUID.test(s);
