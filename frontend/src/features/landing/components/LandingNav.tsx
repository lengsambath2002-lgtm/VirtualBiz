'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Icon, LanguageSwitcher, Logo } from '@/components/ui';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { landingButton } from '../util/landingButton';
import s from './landing.module.css';

const SECTIONS = [
  ['#customers', 'shopAndBook'],
  ['#business', 'forBusiness'],
  ['#pricing', 'pricing'],
  ['#faq', 'help'],
] as const;

/** Sticky glass nav: section links, language, log in, sign up, open shop, and the menu toggle (links collapse into it below 900px). */
export function LandingNav() {
  const t = useTranslations('marketing.nav');
  const [open, setOpen] = useState(false);

  return (
    <header className={s.nav}>
      <div className={cn(s.wrap, s.navIn)}>
        <a className={s.logoLink} href="#top" aria-label={t('home')}>
          <Logo size="marketing" className="gap-[9px] font-extrabold tracking-[-.02em]" />
        </a>
        <nav className={s.links} aria-label={t('label')}>
          {SECTIONS.map(([href, key]) => (
            <a key={href} href={href}>
              {t(key)}
            </a>
          ))}
        </nav>
        <div className={s.navR}>
          <LanguageSwitcher className={s.hideM} />
          <Link className={landingButton('ghost', 'sm', s.hideM)} href="/sign-in">
            {t('logIn')}
          </Link>
          <Link className={cn(s.quietLink, s.hideM)} href="/sign-up">
            {t('signUp')}
          </Link>
          <Link className={landingButton('primary', 'sm')} href="/create-business">
            {t('openShop')}
          </Link>
          <button
            type="button"
            className={s.ib}
            aria-label={t('menu')}
            aria-expanded={open}
            aria-controls="landing-mmenu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon
              name="menu"
              size={20}
              strokeWidth={2}
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
          </button>
        </div>
      </div>
      <nav
        id="landing-mmenu"
        className={cn(s.mmenu, open && s.mmenuOpen)}
        aria-label={t('mobileLabel')}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        {SECTIONS.map(([href, key]) => (
          <a key={href} href={href}>
            {t(key)}
          </a>
        ))}
        <Link href="/sign-in">{t('logIn')}</Link>
        <Link href="/sign-up">{t('signUp')}</Link>
      </nav>
    </header>
  );
}
