'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { businessPatch, patchBusiness } from '../api';
import { useProviderStore, useUi } from '../store';
import type { ProviderBusinessState } from '../types';
import { failMessage } from './useActions';
import { useFmt } from './useFmt';

/**
 * Saves settings fields: shown at once, sent to the API, put back with a toast if it refuses.
 * Resolves true when saved.
 */
export function useSaveBusiness() {
  const { t } = useFmt();
  const qc = useQueryClient();
  return useCallback(
    async (patch: Partial<ProviderBusinessState>) => {
      const store = useProviderStore.getState();
      const before = store.data?.business;
      if (!before) return false;
      store.update((d) => {
        Object.assign(d.business, patch);
      });
      try {
        await patchBusiness(before.id, businessPatch(patch));
        void qc.invalidateQueries({ queryKey: ['business', before.id] });
        void qc.invalidateQueries({
          predicate: (q) => q.queryKey[0] === 'me' && q.queryKey[2] === 'businesses',
        });
        return true;
      } catch (e) {
        useProviderStore.getState().update((d) => {
          d.business = before;
        });
        useUi.getState().showToast(failMessage(t, e));
        return false;
      }
    },
    [t, qc],
  );
}
