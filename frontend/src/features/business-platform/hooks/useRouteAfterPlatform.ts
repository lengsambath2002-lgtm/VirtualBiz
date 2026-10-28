'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { WORKSPACE_HREF } from '@/features/account-switcher';
import { afterSignIn } from '@/features/auth/util/nextPath';
import { useRouter } from '@/lib/i18n/navigation';
import { setActiveBusiness } from '@/lib/workspace';

import type { PlatformRoute } from '../types';
import { saveRoute } from '../util/pending';

/** After the sign-in: the page for its intent (docs/api/platform-sso.md). */
export function useRouteAfterPlatform(onNoAccess: () => void) {
  const router = useRouter();
  const qc = useQueryClient();
  return useCallback(
    (r: PlatformRoute) => {
      // Staff access may have changed with the platform's roles.
      void qc.invalidateQueries({ queryKey: ['me'] });
      if (r.intent === 'connect') {
        saveRoute(r);
        const query: Record<string, string> = { step: 'choose' };
        if (r.orgId) query.org = r.orgId;
        if (r.businessId) query.business = r.businessId;
        router.replace({ pathname: '/platform/connect', query });
        return;
      }
      saveRoute(null);
      if (r.intent === 'open') {
        if (!r.business) return onNoAccess();
        setActiveBusiness(r.business.type, r.business.id);
        router.replace(WORKSPACE_HREF[r.business.type]);
        return;
      }
      router.replace(afterSignIn(r.next));
    },
    [router, qc, onNoAccess],
  );
}
