import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { PlatformCallback } from '@/features/business-platform';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    namespace: 'platform.meta',
  });
  // The URL can carry a one-time code: keep it out of search results and referrers.
  return { title: t('callback'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/** Business Platform sign-in (docs/adr/0003-sso-with-the-business-platform.md). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  return (
    <Suspense>
      <PlatformCallback />
    </Suspense>
  );
}
