'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { useRouter } from '@/lib/i18n/navigation';

import { useSellerStore } from '../store/sellerStore';
import { useUi } from '../store/uiStore';
import type { SellerDb } from '../types';

/** The seeded seller state. Only used under the workspace shell, which waits for it. */
export function useDb(): SellerDb {
  const db = useSellerStore((s) => s.db);
  if (!db) throw new Error('useDb() outside the seller shell');
  return db;
}

export const useActions = () => useSellerStore.getState();

/**
 * Navigate inside the workspace, asking "Leave without saving?" first when the product
 * editor has unsaved changes (prototype hashchange guard).
 */
export function useGo() {
  const router = useRouter();
  const t = useTranslations('seller.editor');
  return useCallback(
    async (href: string) => {
      const ui = useUi.getState();
      if (ui.editorDirty) {
        const ok = await ui.confirm({
          title: t('leaveTitle'),
          body: t('leaveBody'),
          ok: t('leaveOk'),
          danger: true,
        });
        if (!ok) return false;
        useUi.getState().setEditorDirty(false);
      }
      ui.close(true);
      router.push(href);
      return true;
    },
    [router, t],
  );
}
