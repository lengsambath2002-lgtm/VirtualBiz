'use client';

import { useTranslations } from 'next-intl';

import { NotFoundView } from '@/components/feedback';

/** 404 inside the provider workspace frame, pointing back to its start page. */
export default function ProviderNotFound() {
  const t = useTranslations('common.feedback');
  return <NotFoundView home="/provider" homeLabel={t('dashboard')} />;
}
