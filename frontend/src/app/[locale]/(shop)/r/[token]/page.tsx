import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ReceiptPage } from '@/features/receipt-share';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

// A shared receipt carries a secret link: keep it out of search results and referrers.
export const metadata: Metadata = {
  title: 'Receipt',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ReceiptRoute({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  return (
    <Suspense>
      <ReceiptPage token={token} />
    </Suspense>
  );
}
