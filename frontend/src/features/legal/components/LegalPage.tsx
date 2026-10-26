'use client';

import { useLocale, useTranslations } from 'next-intl';

import { LoadFailed } from '@/components/feedback';
import { Link } from '@/lib/i18n/navigation';

import { useLegal, type LegalPageKey } from '../api';
import { LegalText } from './LegalText';
import l from './legal.module.css';

/** Terms or Privacy: the text a super-admin keeps in the console, in the reader's language. */
export function LegalPage({ page }: { page: LegalPageKey }) {
  const t = useTranslations('shop.legal');
  const locale = useLocale();
  const { data, error, refetch, isPending } = useLegal(page);
  const other: LegalPageKey = page === 'terms' ? 'privacy' : 'terms';

  if (error) return <LoadFailed error={error} retry={() => void refetch()} />;
  const khMissing = locale === 'kh' && data && !data.kh.trim();
  const text = data ? (locale === 'kh' && data.kh.trim() ? data.kh : data.en) : '';
  return (
    <article className={l.page} aria-busy={isPending}>
      <header className={l.head}>
        <h1>{t(page)}</h1>
        {data && (
          <p>
            {t('updated', {
              date: new Intl.DateTimeFormat(locale === 'kh' ? 'km-KH' : 'en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Phnom_Penh',
              }).format(new Date(data.updatedAt)),
            })}
          </p>
        )}
      </header>
      {khMissing && <p className={l.note}>{t('englishOnly')}</p>}
      {isPending ? (
        <div className={l.skel} aria-label={t('loading')}>
          {[80, 95, 60, 90, 70].map((w, i) => (
            <span key={i} style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <LegalText text={text} />
      )}
      <footer className={l.foot}>
        <Link href={`/${other}`}>{t(other)}</Link>
        <Link href="/help">{t('questions')}</Link>
      </footer>
    </article>
  );
}
