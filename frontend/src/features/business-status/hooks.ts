'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { formatUsd } from '@/lib/money';

/** Inbox kinds VirtualBiz sends a shop (docs/api/phase7-admin.md § Notifications). */
export const STATUS_KINDS = [
  'BUSINESS_VERIFIED',
  'BUSINESS_REJECTED',
  'BUSINESS_SUSPENDED',
  'BUSINESS_REINSTATED',
  'PAYOUT_SENT',
  'CATEGORY_APPROVED',
  'CATEGORY_REJECTED',
] as const;

/** The text of one of those inbox entries, or null for any other kind. */
export function useStatusNotifText() {
  const t = useTranslations('common.businessStatus.notif');
  return useCallback(
    (kind: string, p: Record<string, string>): string | null => {
      switch (kind) {
        case 'BUSINESS_VERIFIED':
          return t('verified');
        case 'BUSINESS_REJECTED':
          return t('rejected', { reason: p.reason ?? '' });
        case 'BUSINESS_SUSPENDED':
          return t('suspended', { reason: p.reason ?? '' });
        case 'BUSINESS_REINSTATED':
          return t('reinstated');
        case 'PAYOUT_SENT':
          return t('payout', {
            amount: formatUsd(Number(p.amount ?? 0)),
            bakong: p.bakongId ?? '',
          });
        case 'CATEGORY_APPROVED':
          return p.moved === 'false'
            ? t('categoryApprovedKept', { asked: p.asked ?? '', category: p.category ?? '' })
            : t('categoryApproved', { asked: p.asked ?? '', category: p.category ?? '' });
        case 'CATEGORY_REJECTED':
          return t('categoryRejected', { asked: p.asked ?? '', reason: p.reason ?? '' });
        default:
          return null;
      }
    },
    [t],
  );
}
