'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { useBusinessStatus } from '../queries';
import st from './status.module.css';

/**
 * Shown on every workspace page while VirtualBiz has suspended the shop, or after its ID was
 * rejected: the reason, and where to fix it.
 */
export function StatusBanner({
  businessId,
  settingsHref,
}: {
  businessId?: string;
  settingsHref: string;
}) {
  const t = useTranslations('common.businessStatus');
  const { data: b } = useBusinessStatus(businessId);
  if (!b) return null;
  if (b.suspendedAt)
    return (
      <div className={`${st.banner} ${st.bad}`} role="alert">
        <span className={st.dot} />
        <span>
          <strong>{t('suspendedTitle')}</strong>
          {t('suspendedBody', { reason: b.suspendedReason ?? '' })}
        </span>
      </div>
    );
  if (b.verification === 'REJECTED')
    return (
      <div className={`${st.banner} ${st.warn}`} role="status">
        <span className={st.dot} />
        <span>
          <strong>{t('rejectedTitle')}</strong>
          {t('rejectedBody', { reason: b.verificationNote ?? '' })}{' '}
          <Link href={settingsHref}>{t('fix')}</Link>
        </span>
      </div>
    );
  return null;
}
