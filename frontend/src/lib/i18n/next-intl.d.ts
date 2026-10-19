import type messages from '../../../messages/en/index';
import type { routing } from './routing';

// Typed message keys and locales for useTranslations / getTranslations.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
