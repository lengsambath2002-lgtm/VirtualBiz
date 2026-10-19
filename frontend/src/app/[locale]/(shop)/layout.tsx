import { setRequestLocale } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';

import { ShopShell } from '@/features/shop-layout';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

/** Customer marketplace: sticky two-row header, footer and the phone tab bar. */
export default async function ShopLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  return (
    <ShopShell>
      <Suspense>{children}</Suspense>
    </ShopShell>
  );
}
