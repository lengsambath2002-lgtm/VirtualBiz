import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isLocale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const messages = (await import(`../../../messages/${locale}/index.ts`)).default;
  return { locale, messages, timeZone: 'Asia/Phnom_Penh' };
});
