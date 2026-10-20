'use client';

import { useTranslations } from 'next-intl';

import { cx, Ic, type IcName } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

import type { AuditEntry } from '../types';
import { useAdminFmt } from '../util/format';
import a from './audit.module.css';
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
    case 'SETTINGS':
      return '/admin/settings';
    case 'CATEGORY':
      return '/admin/settings?tab=categories';
    default:
      return null;
  }
}

const ICON: Record<AuditEntry['targetType'], IcName> = {
  BUSINESS: 'store',
  USER: 'users',
  ORDER: 'orders',
  REVIEW: 'star',
  PROMOTION: 'tag',
  PAYOUT: 'receipt',
  SETTINGS: 'gear',
  CATEGORY: 'box',
};

/** Red for actions against someone, green for ones in their favour. */
const toneOf = (action: string) =>
  /SUSPENDED|REJECTED|CANCELLED|HIDDEN|ENDED|SIGNED_OUT/.test(action)
    ? a.bad
    : /VERIFIED|REINSTATED|RESTORED|RECORDED|REFUNDED/.test(action)
      ? a.good
      : a.info;

const PP = 'Asia/Phnom_Penh';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: PP });

/** "Commission 5% → 6.5%" chips for a settings change. */
function SettingsChanges({ details }: { details: AuditEntry['details'] }) {
  const t = useTranslations('admin.audit.setting');
  const f = useAdminFmt();
  if (!details) return null;
  const fmt = (k: string, v: unknown) =>
    k === 'commissionPct'
      ? `${Number(v)}%`
      : k === 'payoutDelayDays'
        ? t('days', { n: Number(v) })
        : `${f.int(Number(v))} KHR`;
  const rows = Object.entries(details).filter(
    (e): e is [string, { from: unknown; to: unknown }] =>
      !!e[1] && typeof e[1] === 'object' && 'to' in (e[1] as object),
  );
  if (!rows.length) return null;
  return (
    <span className={a.changes}>
      {rows.map(([k, v]) => (
        <span key={k} className={a.change}>
          {t(k as 'commissionPct')}: {fmt(k, v.from)} → {fmt(k, v.to)}
        </span>
      ))}
    </span>
  );
}

/** Admin actions on one target (or the whole log), newest first, grouped by day. */
export function AuditList({ rows, showTarget }: { rows: AuditEntry[]; showTarget?: boolean }) {
  const t = useTranslations('admin.audit');
  const tt = useTranslations('admin.overview');
  const f = useAdminFmt();
  if (!rows.length) return <Empty title={t('empty')} />;
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  const groups: { key: string; items: AuditEntry[] }[] = [];
  for (const r of rows) {
    const k = dayKey(r.at);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(r);
    else groups.push({ key: k, items: [r] });
  }
  return (
    <ol className={a.list}>
      {groups.map((g) => (
        <li key={g.key}>
          <div className={a.day}>
            {g.key === today
              ? tt('today')
              : g.key === yesterday
                ? t('yesterday')
                : f.date(g.items[0]!.at)}
          </div>
          <ol className={a.list} style={{ padding: 0 }}>
            {g.items.map((e) => {
              const href = auditHref(e);
              return (
                <li key={e.id} className={a.item}>
                  <span className={cx(a.ic, toneOf(e.action))} aria-hidden>
                    <Ic name={ICON[e.targetType] ?? 'alert'} size={16} />
                  </span>
                  <span className={a.body}>
                    <span className={a.what}>
                      <strong>{t(`actions.${e.action}` as 'actions.BUSINESS_VERIFIED')}</strong>
                      {showTarget && e.targetLabel && (
                        <>
                          {' · '}
                          {href ? <Link href={href}>{e.targetLabel}</Link> : e.targetLabel}
                        </>
                      )}
                    </span>
                    {e.reason && <span className={a.reason}>{e.reason}</span>}
                    {e.action === 'SETTINGS_UPDATED' && <SettingsChanges details={e.details} />}
                    <span className={a.who}>{t('byName', { name: e.actorName })}</span>
                  </span>
                  <span className={a.time}>{f.time(e.at)}</span>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
