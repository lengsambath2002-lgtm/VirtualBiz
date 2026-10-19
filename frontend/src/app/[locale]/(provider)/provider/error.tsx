'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ErrorView } from '@/components/feedback';

/** A provider workspace page crashed: the frame stays, the page offers "Try again". */
export default function ProviderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common.feedback');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorView
      error={error}
      retry={reset}
      home="/provider"
      homeLabel={t('dashboard')}
      reference={error.digest}
    />
  );
}
