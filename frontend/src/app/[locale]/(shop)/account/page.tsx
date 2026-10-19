import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';
import { redirect } from '@/lib/i18n/navigation';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/account/overview', locale: isLocale(locale) ? locale : DEFAULT_LOCALE });
}
