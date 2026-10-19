'use client';

import { useTranslations } from 'next-intl';

import { cx, s } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

import type { AuditEntry } from '../types';
import { useAdminFmt } from '../util/format';
import { Empty } from './ui';

/** Where an audit entry's target lives in the console. */
export function auditHref(a: AuditEntry): string | null {
  switch (a.targetType) {
    case 'BUSINESS':
      return `/admin/shops/${a.targetId}`;
    case 'USER':
      return `/admin/users/${a.targetId}`;
    case 'ORDER':
      return `/admin/orders/${encodeURIComponent(a.targetId)}`;
    case 'REVIEW':
      return '/admin/reviews';
    case 'PROMOTION':
      return '/admin/promos';
    case 'PAYOUT':
      return '/admin/payouts';
    default:
      return null;
  }
}

/** Admin actions on one target (or the whole log), newest first. */
export function AuditList({ rows, showTarget }: { rows: AuditEntry[]; showTarget?: boolean }) {
  const t = useTranslations('admin.audit');
  const f = useAdminFmt();
  if (!rows.length) return <Empty title={t('empty')} />;
  return (
    <ol
      style={{ listStyle: 'none', margin: 0, padding: '4px 16px 16px', display: 'grid', gap: 12 }}
    >
      {rows.map((a) => {
        const href = auditHref(a);
        return (
          <li key={a.id} style={{ display: 'grid', gap: 2 }}>
            <span>
              <strong>{t(`actions.${a.action}` as 'actions.BUSINESS_VERIFIED')}</strong>
              {showTarget && a.targetLabel && (
                <>
                  {' · '}
                  {href ? <Link href={href}>{a.targetLabel}</Link> : a.targetLabel}
                </>
              )}
            </span>
            {a.reason && <span className={s.small}>“{a.reason}”</span>}
            <span className={cx(s.tiny, s.muted)}>
              {t('by', { name: a.actorName, date: f.dateTime(a.at) })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
