'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { EmptyView, ErrorView } from '@/components/feedback';
import { cx, Ic, s } from '@/features/seller-shared';
import { photoBg } from '@/lib/utils/photo';

import type { Verification } from '../types';

/** Page title row. */
export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={s.phH}>
      <div>
        <h1>{title}</h1>
        {sub && <p className={s.muted}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

/** Search box that reports its value after typing pauses (300 ms). */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (v === value) return;
    const id = setTimeout(() => onChange(v), 300);
    return () => clearTimeout(id);
  }, [v, value, onChange]);
  return (
    <div className={s.search}>
      <Ic name="search" size={18} />
      <input
        type="search"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}

/** Segmented filter (one of a few values; '' = all). */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          type="button"
          className={cx(value === o.value && s.on)}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "1–20 of 134" with previous / next. */
export function Pager({
  page,
  size,
  total,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const t = useTranslations('admin.common');
  if (total <= size) return null;
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        padding: 12,
      }}
    >
      <span className={cx(s.small, s.muted, s.num)}>{t('range', { from, to, total })}</span>
      <button
        type="button"
        className={cx(s.btn, s.btnGhost, s.btnSm)}
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        {t('prev')}
      </button>
      <button
        type="button"
        className={cx(s.btn, s.btnGhost, s.btnSm)}
        disabled={to >= total}
        onClick={() => onPage(page + 1)}
      >
        {t('next')}
      </button>
    </div>
  );
}

export type Tone = 'ok' | 'info' | 'warn' | 'bad' | 'neutral';

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx(s.pill, s[tone])}>{children}</span>;
}

export function VerificationPill({ v }: { v: Verification }) {
  const t = useTranslations('admin.verification');
  return <Pill tone={v === 'VERIFIED' ? 'ok' : v === 'REJECTED' ? 'bad' : 'warn'}>{t(v)}</Pill>;
}

const ORDER_TONE: Record<string, Tone> = {
  NEW: 'warn',
  ACCEPTED: 'info',
  PACKED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'ok',
  PICKED_UP: 'ok',
  CANCELLED: 'neutral',
  RETURNED: 'bad',
};

export function OrderStatusPill({ status }: { status: string }) {
  const t = useTranslations('admin.orderStatus');
  return <Pill tone={ORDER_TONE[status] ?? 'neutral'}>{t(status as 'NEW')}</Pill>;
}

const PAY_TONE: Record<string, Tone> = {
  PAID: 'ok',
  PENDING: 'warn',
  REFUNDED: 'bad',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

export function PaymentPill({ method, status }: { method?: string; status?: string }) {
  const t = useTranslations('admin.payment');
  if (!status) return <span className={s.muted}>—</span>;
  return (
    <Pill tone={PAY_TONE[status] ?? 'neutral'}>
      {t(`method.${method ?? 'CASH'}` as 'method.CASH')} · {t(`status.${status}` as 'status.PAID')}
    </Pill>
  );
}

/** "Nothing here" inside a panel. */
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return <EmptyView title={title} {...(sub ? { body: sub } : {})} />;
}

/** A list that failed to load, inside its panel, with a retry. */
export function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} size="panel" home={null} />;
}

export function Loading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 48 }} aria-busy="true">
      <span className={s.spin} />
    </div>
  );
}

/** Round avatar or logo: the photo, or initials. */
export function Avatar({
  name,
  url,
  size = 32,
  square,
}: {
  name: string;
  url?: string | null;
  size?: number;
  square?: boolean;
}) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={s.av}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        borderRadius: square ? size * 0.28 : '50%',
        flex: 'none',
        ...photoBg(url),
      }}
      aria-hidden="true"
    >
      {url ? null : letters}
    </span>
  );
}

/** Two-column label / value list. */
export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(110px, auto) 1fr',
        gap: '8px 16px',
        margin: 0,
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt className={cx(s.small, s.muted)}>{k}</dt>
          <dd style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
