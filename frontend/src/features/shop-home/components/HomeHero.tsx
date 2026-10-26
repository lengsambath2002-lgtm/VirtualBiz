'use client';

import { useLocale } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import s from '@/features/shop-shared/shop.module.css';

import { pick, type HomeBanner, type HomeBanners } from '../api';

/** `**CODE**` in a banner's text shows highlighted (a promo code). */
function withCodes(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <b key={i} style={{ color: '#F5B800' }}>
        {part}
      </b>
    ) : (
      part
    ),
  );
}

function Go({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return href.startsWith('https://') ? (
    <a className={className} style={style} href={href} target="_blank" rel="noopener">
      {children}
    </a>
  ) : (
    <Link className={className} style={style} href={href}>
      {children}
    </Link>
  );
}

/** A banner's photo under a shade that keeps its text readable. */
const photo = (url: string | null | undefined): CSSProperties | undefined =>
  url
    ? {
        backgroundImage: `linear-gradient(100deg, rgba(14, 18, 30, 0.82), rgba(14, 18, 30, 0.35)), url("${url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

function Side({ b, tone, locale }: { b: HomeBanner; tone?: string; locale: string }) {
  return (
    <Go
      className={cn(s.miniB, b.imageUrl ? s.onPhoto : tone)}
      href={b.href}
      style={photo(b.imageUrl)}
    >
      {pick(b.eyebrow, locale) && <span className={s.miniEyebrow}>{pick(b.eyebrow, locale)}</span>}
      <strong>{pick(b.title, locale)}</strong>
      {pick(b.body, locale) && <span className={s.small}>{withCodes(pick(b.body, locale))}</span>}
    </Go>
  );
}

/**
 * The homepage's banners: the main one and the two beside it, as a super-admin set them in the
 * console (also its preview, in `lang`). Hidden ones leave room for the others.
 */
export function HomeHero({ banners, lang }: { banners: HomeBanners; lang?: 'en' | 'kh' }) {
  const current = useLocale();
  // The console's preview shows either language.
  const locale = lang ?? current;
  const { main } = banners;
  const sides = [
    { b: banners.side1, tone: s.t3 },
    { b: banners.side2, tone: s.t6 },
  ].filter((x) => x.b.visible);
  if (!main.visible && !sides.length) return null;
  return (
    <section className={cn(s.hero, (!main.visible || !sides.length) && s.heroOne)}>
      {main.visible && (
        <div className={cn(s.banner, main.imageUrl && s.bannerPhoto)} style={photo(main.imageUrl)}>
          {pick(main.eyebrow, locale) && (
            <span className={s.eyebrow}>{pick(main.eyebrow, locale)}</span>
          )}
          <h1>{pick(main.title, locale)}</h1>
          {pick(main.body, locale) && <p>{withCodes(pick(main.body, locale))}</p>}
          {pick(main.cta, locale) && (
            <Go className={cn(s.btn, s.btnAccent)} href={main.href}>
              {pick(main.cta, locale)}
            </Go>
          )}
        </div>
      )}
      {sides.length > 0 && (
        <div className={cn(s.sideB, !main.visible && s.sideRow)}>
          {sides.map(({ b, tone }, i) => (
            <Side key={i} b={b} tone={tone} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
