'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PlatformMark } from '@/features/business-platform/components/PlatformMark';
import { goToPlatform } from '@/features/business-platform/util/start';
import { isApiError } from '@/lib/api';

import { useNextParam } from '../hooks/useFlowActions';
import { Btn } from './parts';

/**
 * "Continue with Business Platform" (docs/adr/0003-sso-with-the-business-platform.md): off to the
 * platform's sign-in, back on `/platform/callback`. Shown only when the server is set up for it.
 */
export function PlatformStart({
  label,
  onError,
}: {
  label: string;
  onError: (m: string | null) => void;
}) {
  const t = useTranslations('platform');
  const next = useNextParam();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    onError(null);
    try {
      await goToPlatform({ intent: 'signin', ...(next ? { next } : {}) });
    } catch (e) {
      setBusy(false);
      onError(
        isApiError(e, 'NOT_CONFIGURED') ? t('errors.notConfigured') : t('errors.startFailed'),
      );
    }
  };

  return (
    <Btn type="button" variant="ghost" onClick={start} busy={busy} busyLabel={t('button.going')}>
      <PlatformMark />
      {label}
    </Btn>
  );
}
