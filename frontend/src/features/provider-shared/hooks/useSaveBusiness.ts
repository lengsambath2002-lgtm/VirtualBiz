'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { ServiceBusiness } from '@/lib/domain';

import { businessPatch, patchBusiness, toBusinessState } from '../api';
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

/**
 * Saves a raw `PATCH /api/businesses/{id}` body (shared settings panels) and takes the API's
 * answer as the workspace's business. Resolves true when saved.
 */
export function useSaveBusinessRaw() {
  const qc = useQueryClient();
  return useCallback(
    async (patch: Record<string, unknown>) => {
      const store = useProviderStore.getState();
      const before = store.data?.business;
      if (!before) return false;
      try {
        const b = await patchBusiness(before.id, patch);
        store.update((d) => {
          d.business = toBusinessState(b, before.ownerName);
        });
        void qc.invalidateQueries({ queryKey: ['business', before.id] });
        return true;
      } catch {
        return false;
      }
    },
    [qc],
  );
}

/** The API shape of the workspace business (for the shared settings panels). */
export function toApiBusiness(b: ProviderBusinessState): ServiceBusiness {
  return {
    ...b,
    street: b.address,
    bookingSettings: {
      onlineBooking: b.online,
      autoConfirm: b.autoConfirm,
      reminderHours: b.reminderHours,
      minNoticeHours: b.minNoticeHours,
      freeCancelHours: b.freeCancelHours,
      bufferMinutes: b.bufferMinutes,
      slotMinutes: b.slotMinutes,
      maxDaysAhead: b.maxDaysAhead,
      tipPresets: b.tipPresets,
    },
  } as ServiceBusiness;
}
