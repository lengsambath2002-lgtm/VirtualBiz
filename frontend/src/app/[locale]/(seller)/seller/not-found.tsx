'use client';

import { useTranslations } from 'next-intl';

import { NotFoundView } from '@/components/feedback';

/** 404 inside the seller workspace frame, pointing back to its start page. */
export default function SellerNotFound() {
  const t = useTranslations('common.feedback');
  return <NotFoundView home="/seller" homeLabel={t('dashboard')} />;
}
