import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Khmer } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';
import { serverGet } from '@/lib/api/server';
import { setKhrRate } from '@/lib/money';
import { isLocale, SUPPORTED_LOCALES } from '@/lib/i18n/config';

import '../globals.css';

// Font stack per the design tokens: -apple-system / SF Pro Text first (Apple devices),
// then Inter, then Noto Sans Khmer for Khmer glyphs. Exposed as CSS variables used by --f-body.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const khmer = Noto_Sans_Khmer({ subsets: ['khmer'], variable: '--font-khmer', display: 'swap' });

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('title'), template: '%s — VirtualBiz' },
    description: t('description'),
  };
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  // The riel rate is a platform setting; server and browser render prices with the same one.
  const settings = await serverGet<{ khrPerUsd: number }>('/meta/settings', 60);
  setKhrRate(settings?.khrPerUsd);

  return (
    <html
      lang={locale === 'kh' ? 'km' : 'en'}
      className={`${inter.variable} ${khmer.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers khrPerUsd={settings?.khrPerUsd ?? null}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
