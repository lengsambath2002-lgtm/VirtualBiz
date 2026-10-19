'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ErrorView } from '@/components/feedback';

/** A marketplace page crashed: the frame stays, the page offers "Try again". */
export default function ShopError({
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
      home="/home"
      homeLabel={t('home')}
      reference={error.digest}
    />
  );
}
