'use client';

import { useTranslations } from 'next-intl';

import { NotFoundView } from '@/components/feedback';

/** 404 inside the admin console frame, pointing back to its start page. */
export default function AdminNotFound() {
  const t = useTranslations('common.feedback');
  return <NotFoundView home="/admin" homeLabel={t('console')} />;
}
