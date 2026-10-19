'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Toast } from '@/components/glass';
import { useRouter } from '@/lib/i18n/navigation';

import type { DistrictId } from '../types';
import { landingButton } from '../util/landingButton';
import { searchHref } from '../util/searchHref';
import s from './landing.module.css';

/** Toast duration and the pause before navigating, as in the prototype. */
const TOAST_MS = 2500;
const NAVIGATE_DELAY_MS = 500;

/** Hero search pill: query + district → `/search?q=…&district=…`, after a short toast. */
export function HeroSearch({ districts }: { districts: DistrictId[] }) {
  const t = useTranslations('marketing.hero');
  const tc = useTranslations('common');
  const router = useRouter();
  const [district, setDistrict] = useState<DistrictId | undefined>(districts[0]);
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    timers.current.forEach(clearTimeout);
    setToast(
      q
        ? t('toastResults', { query: q, district: district ? tc(`districts.${district}`) : '' })
        : t('toastApp'),
    );
    timers.current = [
      setTimeout(() => setToast(null), TOAST_MS),
      setTimeout(() => router.push(searchHref({ q, district })), NAVIGATE_DELAY_MS),
    ];
  };

  return (
    <>
      <form className={s.hsearch} role="search" onSubmit={onSubmit}>
        <input name="q" placeholder={t('searchPlaceholder')} aria-label={t('searchLabel')} />
        <select
          aria-label={t('districtLabel')}
          value={district}
          onChange={(e) => setDistrict(e.target.value as DistrictId)}
        >
          {districts.map((id) => (
            <option key={id} value={id}>
              {tc(`districts.${id}`)}
            </option>
          ))}
        </select>
        <button type="submit" className={landingButton('primary')}>
          {t('search')}
        </button>
      </form>
      <Toast message={toast} />
    </>
  );
}
