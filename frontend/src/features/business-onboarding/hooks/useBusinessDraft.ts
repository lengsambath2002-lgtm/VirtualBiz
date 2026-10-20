'use client';

import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import type { BusinessDraft } from '../types';
import { blankDraft, DRAFT_STORAGE_KEY } from '../util/draft';

interface DraftState {
  /** null until the user changes something (the prototype only saves after an edit). */
  draft: BusinessDraft | null;
  patch: (patch: Partial<BusinessDraft>, base: BusinessDraft) => void;
  /** Drop the draft (start a new business). */
  reset: () => void;
}

type Persisted = Pick<DraftState, 'draft'>;

/**
 * Keeps the prototype's storage format: the raw draft JSON under `vb-biz2` (no zustand
 * envelope). Writes are best-effort: a large ID photo can exceed the quota, which the
 * prototype also swallows.
 */
const rawDraftStorage: PersistStorage<Persisted> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      const draft = raw ? (JSON.parse(raw) as BusinessDraft | null) : null;
      return { state: { draft: draft && typeof draft === 'object' ? draft : null }, version: 0 };
    } catch {
      return null;
    }
  },
  setItem: (name, value: StorageValue<Persisted>) => {
    try {
      if (value.state.draft) localStorage.setItem(name, JSON.stringify(value.state.draft));
    } catch {
      /* quota or blocked storage: keep the in-memory draft */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      draft: null,
      // A stored draft that is someone else's is replaced, not merged into.
      patch: (patch, base) =>
        set((s) => ({
          draft: { ...(s.draft && s.draft.ownerId === base.ownerId ? s.draft : base), ...patch },
        })),
      reset: () => {
        rawDraftStorage.removeItem(DRAFT_STORAGE_KEY);
        set({ draft: null });
      },
    }),
    {
      name: DRAFT_STORAGE_KEY,
      storage: rawDraftStorage,
      partialize: (s) => ({ draft: s.draft }),
      skipHydration: true,
    },
  ),
);

/**
 * The onboarding draft for the signed-in user. Rehydrates from localStorage after mount so
 * the server render and first client render agree (`ready` is false until then). A stored
 * draft that another account started on this browser is ignored: this user starts blank.
 */
export function useBusinessDraft(userId: string | undefined, userPhone: string | undefined) {
  const stored = useDraftStore((s) => s.draft);
  const patchStore = useDraftStore((s) => s.patch);
  const [ready, setReady] = useState(() => useDraftStore.persist.hasHydrated());

  useEffect(() => {
    if (useDraftStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    const unsub = useDraftStore.persist.onFinishHydration(() => setReady(true));
    void useDraftStore.persist.rehydrate();
    return unsub;
  }, []);

  const base = useMemo(() => blankDraft(userPhone, userId), [userPhone, userId]);
  const draft = stored && userId && stored.ownerId === userId ? stored : base;
  const update = useMemo(
    () => (patch: Partial<BusinessDraft>) => patchStore(patch, base),
    [patchStore, base],
  );

  const reset = useDraftStore((s) => s.reset);
  return { draft, update, reset, ready };
}
