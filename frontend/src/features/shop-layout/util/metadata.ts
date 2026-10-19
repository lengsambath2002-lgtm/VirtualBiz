import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

import type messages from '../../../../messages/en/index';

export type ShopPageKey = keyof (typeof messages)['shop']['meta'];

/** `generateMetadata` for a shop page: the translated title (layout adds " — VirtualBiz"). */
export function shopMetadata(key: ShopPageKey) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({
      locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
      namespace: 'shop.meta',
    });
    return { title: t(key) };
  };
}
