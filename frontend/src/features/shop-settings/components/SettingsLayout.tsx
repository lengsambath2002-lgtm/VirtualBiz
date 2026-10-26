'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/lib/i18n/navigation';

import l from './layout.module.css';

// 24×24, 1.8 stroke, like the workspace icon sets.
const ICONS = {
  store: (
    <>
      <path d="M4 9h16l-1.5-5h-13z" />
      <path d="M5 9v11h14V9M10 20v-6h4v6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  bag: (
    <>
      <path d="M6 7h12l1 13H5z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.8 3 2.6 3.5 5.2" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.3" />
    </>
  ),
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  back: <path d="m15 6-6 6 6 6" />,
} as const;

export type SettingsIcon = Exclude<keyof typeof ICONS, 'chevron' | 'back'>;

function Svg({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export interface SettingsSection {
  /** In the URL: `?section=<key>`. */
  key: string;
  icon: SettingsIcon;
  title: string;
  /** One line under the title in the menu: what is in the section. */
  hint: string;
  content: ReactNode;
}

export interface SettingsLink {
  href: string;
  icon: SettingsIcon;
  title: string;
  hint: string;
}

/**
 * A workspace's settings in sections. Wider screens: the section menu on the left, the chosen
 * section (the first by default) on the right. Phones: the menu as a list; a section opens on its
 * own with a way back, like a phone's settings app. The section is in the URL, so the browser's
 * back button and links (`/seller/settings?section=payments`) work. `links` go to other pages
 * that are settings too (team, promotions …).
 */
export function SettingsLayout({
  title,
  intro,
  sections,
  links = [],
}: {
  title: string;
  /** Above the sections (e.g. "only the owner or a manager can change settings"). */
  intro?: ReactNode;
  sections: SettingsSection[];
  links?: SettingsLink[];
}) {
  const t = useTranslations('shopSettings.nav');
  const pathname = usePathname();
  const asked = useSearchParams().get('section');
  const open = sections.find((x) => x.key === asked);
  const shown = open ?? sections[0];

  const row = (
    key: string,
    href: string,
    icon: SettingsIcon,
    name: string,
    hint: string,
    current: boolean,
  ) => (
    <li key={key}>
      <Link href={href} className={l.item} aria-current={current ? 'page' : undefined}>
        <span className={l.ico}>
          <Svg name={icon} />
        </span>
        <span className={l.txt}>
          <strong>{name}</strong>
          <small>{hint}</small>
        </span>
        <span className={l.chev}>
          <Svg name="chevron" />
        </span>
      </Link>
    </li>
  );

  return (
    <div className={l.root} data-open={open ? '' : undefined}>
      <div className={l.head}>
        <h1>{title}</h1>
      </div>
      {intro && <div className={l.intro}>{intro}</div>}
      <div className={l.cols}>
        <nav className={l.nav} aria-label={t('label')}>
          <ul className={l.group}>
            {sections.map((x) =>
              row(x.key, `${pathname}?section=${x.key}`, x.icon, x.title, x.hint, x === shown),
            )}
          </ul>
          {links.length > 0 && (
            <>
              <h2 className={l.groupH}>{t('more')}</h2>
              <ul className={l.group}>
                {links.map((x) => row(x.href, x.href, x.icon, x.title, x.hint, false))}
              </ul>
            </>
          )}
        </nav>
        {shown && (
          <div className={l.main}>
            <div className={l.mainH}>
              <Link href={pathname} className={l.back}>
                <Svg name="back" />
                {t('back')}
              </Link>
              <h2>{shown.title}</h2>
              <p>{shown.hint}</p>
            </div>
            <div className={l.body}>{shown.content}</div>
          </div>
        )}
      </div>
    </div>
  );
}
