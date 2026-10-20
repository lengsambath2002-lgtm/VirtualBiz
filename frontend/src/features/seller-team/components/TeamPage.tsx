'use client';

import { useTranslations } from 'next-intl';

import { TeamAccess } from '@/features/business-team';
import { s, useDb } from '@/features/seller-shared';

/** `/seller/team`: who works in this shop and what each person can do. */
export function TeamPage() {
  const t = useTranslations('team');
  const db = useDb();
  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('pageTitle')}</h1>
          <p className={s.muted}>{t('pageSub')}</p>
        </div>
      </div>
      <TeamAccess businessId={db.shop.id} />
    </>
  );
}
