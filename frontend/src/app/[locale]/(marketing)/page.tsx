import { setRequestLocale } from 'next-intl/server';

import {
  BusinessBand,
  CustomersSection,
  FaqSection,
  FinalCta,
  LandingFooter,
  LandingHero,
  LandingNav,
  LandingShell,
  OpenShopSection,
  PaymentStrip,
  PricingSection,
  toLandingCategories,
  toLandingDistricts,
} from '@/features/landing';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';
import type { ApiCategory, ApiDistrict } from '@/lib/api';
import { serverGet } from '@/lib/api/server';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  const [districts, categories] = await Promise.all([
    serverGet<ApiDistrict[]>('/meta/districts'),
    serverGet<ApiCategory[]>('/meta/categories?marketplace=true'),
  ]);

  return (
    <LandingShell>
      <LandingNav />
      <main id="top">
        <LandingHero districts={toLandingDistricts(districts ?? [])} />
        <PaymentStrip />
        <CustomersSection categories={toLandingCategories(categories ?? [])} />
        <BusinessBand />
        <PricingSection />
        <OpenShopSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </LandingShell>
  );
}
