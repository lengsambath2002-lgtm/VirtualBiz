import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

/** A text in English and Khmer; an empty Khmer text shows the English one. */
export interface Localized {
  en: string;
  kh: string;
}

/** One homepage banner (docs/api/site-content.md). `body` may mark a promo code as **CODE**. */
export interface HomeBanner {
  visible: boolean;
  eyebrow: Localized;
  title: Localized;
  body: Localized;
  cta: Localized;
  href: string;
  /** Background photo (`/api/files/…`), or none. */
  imageUrl?: string | null;
}

export interface HomeBanners {
  main: HomeBanner;
  side1: HomeBanner;
  side2: HomeBanner;
  updatedAt?: string;
  updatedBy?: string | null;
}

export const homeBannersKey = ['home-banners'] as const;

/** The banners a super-admin keeps in the console; the page's server render seeds them. */
export const useHomeBanners = (initial: HomeBanners | null) =>
  useQuery({
    queryKey: homeBannersKey,
    queryFn: () => apiFetch<HomeBanners>('/meta/home-banners', { auth: false }),
    initialData: initial ?? undefined,
    // The server render may be up to a minute old: check again once the page is up.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });

/** The text in the page's language. */
export const pick = (t: Localized, locale: string) =>
  locale === 'kh' && t.kh.trim() ? t.kh : t.en;
