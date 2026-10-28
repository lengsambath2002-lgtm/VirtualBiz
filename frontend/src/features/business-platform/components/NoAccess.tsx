'use client';

import { useTranslations } from 'next-intl';

import { feedbackButton, StatusView } from '@/components/feedback';
import { Link } from '@/lib/i18n/navigation';

/** Signed in, but the shop to open isn't theirs (not in its organisation, or a guest there). */
export function NoAccess() {
  const t = useTranslations('platform.open');
  return (
    <StatusView
      kind="forbidden"
      title={t('noAccessTitle')}
      body={t('noAccessBody')}
      actions={
        <Link className={feedbackButton(true)} href="/home">
          {t('home')}
        </Link>
      }
    />
  );
}
