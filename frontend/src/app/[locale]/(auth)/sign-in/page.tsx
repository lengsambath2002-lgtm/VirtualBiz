import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthFlow } from '@/features/auth';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    namespace: 'auth',
  });
  return { title: t('meta.signIn') };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  return (
    <Suspense>
      <AuthFlow page="sign-in" />
    </Suspense>
  );
}
