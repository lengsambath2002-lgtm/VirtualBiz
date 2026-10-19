'use client';

import { useTranslations } from 'next-intl';

import { NotFoundView } from '@/components/feedback';

/** 404 inside the marketplace frame, pointing back to its start page. */
export default function ShopNotFound() {
  const t = useTranslations('common.feedback');
  return <NotFoundView home="/home" homeLabel={t('home')} />;
}
