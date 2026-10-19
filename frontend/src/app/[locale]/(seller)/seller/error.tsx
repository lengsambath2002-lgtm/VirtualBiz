'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ErrorView } from '@/components/feedback';

/** A seller workspace page crashed: the frame stays, the page offers "Try again". */
export default function SellerError({
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
      home="/seller"
      homeLabel={t('dashboard')}
      reference={error.digest}
    />
  );
}
