import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

import { AdminShell } from '@/features/admin-shell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    namespace: 'admin.meta',
  });
  // Staff pages stay out of search engines.
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
