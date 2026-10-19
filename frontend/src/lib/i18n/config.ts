// Single source of truth for supported locales. Routing, middleware, the language menu and
// `pnpm i18n:lint` all derive from this list. The first entry is the default/fallback.
// `kh` is the app code for Khmer (not a BCP-47 tag) — use `intlLocaleFor` for Intl APIs.
export const SUPPORTED_LOCALES = ['en', 'kh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Each language's name in itself — the same in every UI language. */
export const LOCALE_ENDONYMS: Record<Locale, string> = { en: 'English', kh: 'ខ្មែរ' };

/** Compact label for tight language pickers (landing nav: "EN" / "ខ្មែរ"). */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = { en: 'EN', kh: 'ខ្មែរ' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** App locale → BCP-47 tag for Intl (Intl.NumberFormat, toLocaleDateString, …). */
export function intlLocaleFor(locale: string): string {
  return locale === 'kh' ? 'km-KH' : 'en-US';
}

/** Business display timezone (times are stored in UTC). */
export const DISPLAY_TIME_ZONE = 'Asia/Phnom_Penh';
