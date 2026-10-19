import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';

import { ProviderShell } from '@/features/provider-workspace';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

// The prototype sets times and kbd hints in JetBrains Mono (500).
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-jbmono',
  display: 'swap',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    namespace: 'provider.meta',
  });
  return { title: t('title') };
}

export default async function ProviderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  return (
    <div className={mono.variable}>
      <Suspense>
        <ProviderShell>{children}</ProviderShell>
      </Suspense>
    </div>
  );
}
