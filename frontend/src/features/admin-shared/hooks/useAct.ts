'use client';

import { useTranslations } from 'next-intl';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { useUi } from '@/features/seller-shared';

/**
 * Runs an admin action with the console's confirm dialog (optionally asking for a reason) and a
 * toast for the outcome. Resolves the result, or null when cancelled or refused.
 */
export function useAct() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  return async function act<R>(opts: {
    title: string;
    body?: string;
    ok: string;
    danger?: boolean;
    /** Ask for a reason (shown to the person affected and kept in the audit log). */
    reason?: 'required' | 'optional';
    reasonLabel?: string;
    done: string;
    run: (reason: string) => Promise<R>;
  }): Promise<R | null> {
    const ui = useUi.getState();
    for (;;) {
      const v = await ui.confirm({
        title: opts.title,
        ...(opts.body ? { body: opts.body } : {}),
        ok: opts.ok,
        ...(opts.danger ? { danger: true } : {}),
        ...(opts.reason
          ? {
              fields: [
                {
                  type: 'input' as const,
                  key: 'reason',
                  label:
                    opts.reasonLabel ??
                    t(opts.reason === 'required' ? 'common.reason' : 'common.note'),
                },
              ],
            }
          : {}),
      });
      if (!v) return null;
      const reason = String(v.reason ?? '').trim();
      if (opts.reason === 'required' && reason.length < 3) {
        ui.showToast(t('common.reasonNeeded'));
        continue;
      }
      try {
        const r = await opts.run(reason);
        ui.showToast(opts.done);
        return r;
      } catch (e) {
        const code = isApiError(e) ? e.code : '';
        const known = [
          'SUPER_ADMIN_ONLY',
          'ADMIN_ONLY',
          'FORBIDDEN',
          'CONFLICT',
          'INVALID_STATUS_TRANSITION',
          'VERIFICATION_REQUIRED',
          'PAYOUT_ACCOUNT_MISSING',
          'NOTHING_TO_PAY',
          'VALIDATION_FAILED',
          'LAST_SUPER_ADMIN',
        ];
        ui.showToast(
          known.includes(code) ? t(`errors.${code}` as 'errors.CONFLICT') : tc(fallbackErrorKey(e)),
        );
        return null;
      }
    }
  };
}
