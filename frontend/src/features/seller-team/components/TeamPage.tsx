'use client';

import { useTranslations } from 'next-intl';

import { ActivityLog } from '@/features/business-activity';
import { TeamAccess } from '@/features/business-team';
import { cx, s, useDb } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

/** `/seller/team`: who works in this shop and what each person can do. */
export function TeamPage() {
  const t = useTranslations('team');
  const ta = useTranslations('activity');
  const db = useDb();
  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('pageTitle')}</h1>
          <p className={s.muted}>{t('pageSub')}</p>
        </div>
        <Link href="/seller/activity" className={cx(s.btn, s.btnGhost)}>
          {ta('open')}
        </Link>
      </div>
      <TeamAccess businessId={db.shop.id} />
    </>
  );
}

/** `/seller/activity`: who did what in this shop (owners and managers). */
export function ActivityPage() {
  const db = useDb();
  return <ActivityLog businessId={db.shop.id} />;
}
