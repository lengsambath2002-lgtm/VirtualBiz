import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { InviteAcceptPage } from '@/features/staff-invite';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    namespace: 'admin.invite',
  });
  // An invite link carries a secret: keep it out of search results and referrers.
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function StaffInviteRoute({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  return <InviteAcceptPage token={token} />;
}
