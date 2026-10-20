'use client';

import { useTranslations } from 'next-intl';

import { cx, s, type SellerOrder } from '@/features/seller-shared';

/** "Phone", "Facebook", … on an order the shop entered itself; nothing for marketplace orders. */
export function SourcePill({ o }: { o: Pick<SellerOrder, 'source'> }) {
  const t = useTranslations('seller.manual.source');
  if (!o.source || o.source === 'ONLINE') return null;
  return <span className={cx(s.pill, s.neutral)}>{t(o.source)}</span>;
}
