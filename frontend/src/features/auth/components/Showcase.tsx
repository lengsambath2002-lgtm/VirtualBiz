import { useTranslations } from 'next-intl';

import { ShowIcon } from './icons';
import s from './signIn.module.css';

// Mock-card tints are fixed light colours in the prototype (unchanged in dark mode).
const CARDS = [
  {
    key: 'massage',
    icon: (
      <>
        <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" />
        <path d="M5 19l7-7" />
      </>
    ),
    tint: { background: '#E6F3E4', color: '#2D6B2A' },
    pill: 'booked',
    pillTint: { background: '#E5F5EC', color: '#1C8556' },
  },
  {
    key: 'latte',
    icon: (
      <>
        <path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
        <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
      </>
    ),
    tint: { background: '#FCE9D6', color: '#9A4B12' },
    pill: 'onTheWay',
    pillTint: { background: '#EAF0FE', color: '#2F5BD3' },
  },
  {
    key: 'salon',
    icon: (
      <>
        <path d="M3 9 4.5 4h15L21 9" />
        <path d="M4 9v11h16V9" />
        <path d="M3 9h18M9 20v-6h6v6" />
      </>
    ),
    tint: { background: '#FFF1C7', color: '#7A5B00' },
    pill: 'yourShop',
    pillTint: { background: '#FFF4CC', color: '#7A5B00' },
  },
] as const;

/** Right-hand navy panel: one account for shopping, booking and selling (hidden ≤960px). */
export function Showcase() {
  const t = useTranslations('auth.showcase');
  return (
    <aside className={s.show} aria-hidden="true">
      <div>
        <h2>{t.rich('title', { em: (c) => <em>{c}</em> })}</h2>
        <p>{t('body')}</p>
      </div>
      <div className={s.mock}>
        {CARDS.map((c) => (
          <div key={c.key} className={s.mcard}>
            <div className={s.mic} style={c.tint}>
              <ShowIcon>{c.icon}</ShowIcon>
            </div>
            <div>
              <strong>{t(c.key)}</strong>
              <small>{t(`${c.key}Meta`)}</small>
            </div>
            <span className={s.pill} style={c.pillTint}>
              {t(c.pill)}
            </span>
          </div>
        ))}
      </div>
      <div className={s.trust}>
        <span>
          <ShowIcon size={16}>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </ShowIcon>
          {t('encrypted')}
        </span>
        <span>
          <ShowIcon size={16}>
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </ShowIcon>
          {t('noSell')}
        </span>
      </div>
    </aside>
  );
}
