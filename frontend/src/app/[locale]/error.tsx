'use client';

import { useEffect } from 'react';

import { ErrorView, FeedbackScreen } from '@/components/feedback';

/** A page or surface layout crashed: say so, offer "Try again", and give a reference. */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <FeedbackScreen>
      <ErrorView error={error} retry={reset} reference={error.digest} />
    </FeedbackScreen>
  );
}
