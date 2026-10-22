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
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '@/lib/platform/settings';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
  const [districts, categories, settings] = await Promise.all([
    serverGet<ApiDistrict[]>('/meta/districts'),
    serverGet<ApiCategory[]>('/meta/categories?marketplace=true'),
    serverGet<PlatformSettings>('/meta/settings', 60),
  ]);
  // Each figure falls back on its own: no API (a build without one) or a partial answer still
  // renders the page.
  const d = DEFAULT_PLATFORM_SETTINGS;
  const num = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) && v !== null ? Number(v) : fallback;
  const commissionPct = num(settings?.commissionPct, d.commissionPct);
  const payoutDelayDays = num(settings?.payoutDelayDays, d.payoutDelayDays);
  const khrPerUsd = num(settings?.khrPerUsd, d.khrPerUsd);

  return (
    <LandingShell>
      <LandingNav />
      <main id="top">
        <LandingHero districts={toLandingDistricts(districts ?? [])} />
        <PaymentStrip />
        <CustomersSection categories={toLandingCategories(categories ?? [])} />
        <BusinessBand />
        <PricingSection commissionPct={commissionPct} payoutDays={payoutDelayDays} />
        <OpenShopSection />
        <FaqSection payoutDays={payoutDelayDays} />
        <FinalCta />
      </main>
      <LandingFooter khrPerUsd={khrPerUsd} />
    </LandingShell>
  );
}
