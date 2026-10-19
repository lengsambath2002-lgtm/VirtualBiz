import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { getTranslations } from 'next-intl/server';

import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';
import type { ReactNode } from 'react';

import { SellerShell } from '@/features/seller-shell';

// The prototype's mono face (receipts, codes, scan boxes, ⌘K hint).
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-mono-seller',
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
    namespace: 'seller.meta',
  });
  return { title: t('title') };
}

export default function SellerLayout({ children }: { children: ReactNode }) {
  return <SellerShell fontClass={mono.variable}>{children}</SellerShell>;
}
