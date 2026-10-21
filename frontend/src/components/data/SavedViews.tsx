'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { api, isApiError } from '@/lib/api';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import d from './data.module.css';

interface View {
  id: string;
  name: string;
  query: string;
}

/** A query without paging, sorted, to compare a view with the URL. */
const norm = (q: string) =>
  [...new URLSearchParams(q).entries()]
    .filter(([k]) => k !== 'page')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

/**
 * Saved views (docs/api/phase17-more-lists.md): the person's named filter sets for this list,
 * kept on their account. Picking one puts its filters in the URL; "Save view" names the current
 * ones; the active view can be deleted.
 */
export function SavedViews({ list }: { list: string }) {
  const t = useTranslations('common.data.views');
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const key = ['views', list];
  const { data: views } = useQuery({
    queryKey: key,
    queryFn: () => api.get<View[]>(`/me/views?list=${encodeURIComponent(list)}`),
    staleTime: 60_000,
  });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const now = norm(sp.toString());
  const active = views?.find((v) => norm(v.query) === now && now !== '');

  const apply = (id: string) => {
    const v = views?.find((x) => x.id === id);
    router.replace(v && v.query ? `${pathname}?${v.query}` : pathname, { scroll: false });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/me/views', { list, name: name.trim(), query: sp.toString() });
      await qc.invalidateQueries({ queryKey: key });
      setNaming(false);
      setName('');
      setErr('');
    } catch (x) {
      setErr(isApiError(x, 'VALIDATION_FAILED') ? t('tooMany') : t('failed'));
    }
  };
  const remove = async () => {
    if (!active) return;
    await api.delete(`/me/views/${active.id}`);
    await qc.invalidateQueries({ queryKey: key });
  };

  return (
    <span className={d.views}>
      {!!views?.length && (
        <label className={cn(d.select, active && d.selectOn)}>
          <span aria-hidden>{t('label')}</span>
          <select
            aria-label={t('label')}
            value={active?.id ?? ''}
            onChange={(e) => apply(e.target.value)}
          >
            <option value="">{t('none')}</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {active ? (
        <button type="button" className={d.btn} onClick={() => void remove()}>
          {t('delete')}
        </button>
      ) : naming ? (
        <form className={d.viewForm} onSubmit={save}>
          <input
            autoFocus
            value={name}
            maxLength={60}
            placeholder={t('namePh')}
            aria-label={t('name')}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={cn(d.btn, d.primary)} disabled={!name.trim()}>
            {t('save')}
          </button>
          <button type="button" className={d.btn} onClick={() => setNaming(false)}>
            {t('cancel')}
          </button>
          {err && (
            <span className={d.exportErr} role="alert">
              {err}
            </span>
          )}
        </form>
      ) : (
        now && (
          <button type="button" className={d.btn} onClick={() => setNaming(true)}>
            {t('saveCurrent')}
          </button>
        )
      )}
    </span>
  );
}
