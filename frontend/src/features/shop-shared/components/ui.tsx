'use client';

import { useTranslations } from 'next-intl';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';

import { NotFoundView } from '@/components/feedback';
import { Sheet } from '@/components/glass';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { photoBg } from '@/lib/utils/photo';

import { swatchOf } from '../rules';
import s from '../shop.module.css';
import type { Item, ShopView } from '../types';
import { Ic, isIcName } from './Ic';

const TINT = { 1: s.t1, 2: s.t2, 3: s.t3, 4: s.t4, 5: s.t5, 6: s.t6 } as const;
export const tintClass = (hue: number) => TINT[(hue as keyof typeof TINT) || 1] ?? s.t1;

/** Media placeholder: tinted gradient + the shop's object icon (no external images). */
export function Ph({
  hue,
  icon,
  photo,
  className,
  style,
}: {
  hue: number;
  icon: string;
  /** An uploaded photo (shop logo or cover) shown instead of the icon. */
  photo?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(s.ph, tintClass(hue), className)}
      style={photo ? { ...style, ...photoBg(photo) } : style}
    >
      {!photo && isIcName(icon) && <Ic name={icon} size={64} />}
    </div>
  );
}

/** Item placeholder, tinted with the selected colour swatch when there is one. */
export function ItemPh({
  it,
  shop,
  sel,
  className,
}: {
  it: Item;
  shop?: ShopView;
  sel?: Record<string, string>;
  className?: string;
}) {
  const c = swatchOf(it, sel);
  const photo = it.photos?.[0];
  return (
    <Ph
      hue={shop?.hue ?? 1}
      icon={shop?.icon ?? 'store'}
      {...(photo ? { photo } : {})}
      className={className}
      style={
        c && !photo
          ? { background: `linear-gradient(135deg,${c},color-mix(in srgb,${c} 70%,#000))` }
          : undefined
      }
    />
  );
}

/** One filled star (cards). */
export function Star({ n, size = 13 }: { n: number; size?: number }) {
  const t = useTranslations('shop.common');
  return (
    <span className={s.star} role="img" aria-label={t('outOf5', { n: n.toFixed(1) })}>
      <Ic name="star" size={size} />
    </span>
  );
}

/** Five stars, `n` filled. */
export function StarRow({ n, size = 13 }: { n: number; size?: number }) {
  const t = useTranslations('shop.common');
  return (
    <span className={s.star} role="img" aria-label={t('outOf5', { n: String(n) })}>
      {[1, 2, 3, 4, 5].map((k) => (
        <Ic key={k} name="star" size={size} {...(k <= n ? {} : { style: { opacity: 0.3 } })} />
      ))}
    </span>
  );
}

export function Crumbs({
  items,
}: {
  items: { label: ReactNode; href?: ComponentProps<typeof Link>['href'] }[];
}) {
  return (
    <nav className={s.crumbs} aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span>›</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="num">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Spin() {
  return <span className={s.spin} />;
}

export type PillTone = 'ok' | 'info' | 'warn' | 'bad' | 'neutral';
export function Pill({
  tone,
  children,
  className,
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(s.pill, s[tone], className)}>{children}</span>;
}

/** Glass sheet with the shop resets applied to its (portaled) content. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  const tc = useTranslations('common');
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel={tc('close')}>
      <div className={s.mroot}>{children}</div>
    </Sheet>
  );
}

/** The prototype's "Log in to …" empty state for gated pages. */
export function Gate({ title, onLogin }: { title: string; onLogin: () => void }) {
  const t = useTranslations('shop');
  return (
    <div className={cn(s.empty, s.emptyTall, s.glassMat)}>
      <Ic name="user" size={32} />
      <strong>{title}</strong>
      <span>{t('gate.body')}</span>
      <button className={cn(s.btn, s.btnPrimary)} onClick={onLogin}>
        {t('header.login')}
      </button>
    </div>
  );
}

/** A product, shop, order or booking that doesn't exist (or isn't the customer's). */
export function NotFound({ title }: { title?: string }) {
  const t = useTranslations('shop.common');
  return <NotFoundView home="/home" homeLabel={t('backHome')} {...(title ? { title } : {})} />;
}
