'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ErrorView } from '@/components/feedback';

/** A admin console page crashed: the frame stays, the page offers "Try again". */
export default function AdminError({
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
      home="/admin"
      homeLabel={t('console')}
      reference={error.digest}
    />
  );
}
