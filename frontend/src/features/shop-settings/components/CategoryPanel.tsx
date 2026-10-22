'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { api, isApiError } from '@/lib/api';
import type { Business } from '@/lib/domain';
import { cn } from '@/lib/utils/cn';

import c from './settings.module.css';
import type { SaveBusiness } from './Panels';

interface PlatformCategory {
  id: string;
  name: string;
  nameKh: string;
  businessType: 'PRODUCT' | 'SERVICE';
  inMarketplace: boolean;
}

interface Suggestion {
  id: string;
  name: string;
  nameKh?: string | null;
  note?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  requestedByName: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
  categoryId?: string | null;
  createdAt: string;
}

/**
 * "Marketplace category" (docs/api/phase19-category-requests.md): where shoppers find the shop.
 * The owner picks one of VirtualBiz's categories for the shop's kind; when none fits, they
 * suggest one, which platform staff approve (as a new category or an existing one) or decline.
 */
export function CategoryPanel({
  business,
  save,
  canEdit,
}: {
  business: Business;
  save: SaveBusiness;
  canEdit: boolean;
}) {
  const t = useTranslations('shopSettings.category');
  const locale = useLocale();
  const qc = useQueryClient();
  const { data: cats } = useQuery({
    queryKey: ['meta', 'categories', 'all'],
    queryFn: () => api.get<PlatformCategory[]>('/meta/categories', { auth: false }),
    staleTime: 10 * 60_000,
  });
  const key = ['categoryRequests', business.id];
  const { data: mine } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Suggestion[]>('/category-requests', { businessId: business.id }),
  });
  const [cat, setCat] = useState(business.categoryId);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [form, setForm] = useState<{ name: string; nameKh: string; note: string } | null>(null);
  const [err, setErr] = useState('');
  const label = (x: PlatformCategory) => (locale === 'kh' && x.nameKh ? x.nameKh : x.name);
  const nameOf = (id?: string | null) => {
    const x = cats?.find((y) => y.id === id);
    return x ? label(x) : (id ?? '');
  };
  const options = (cats ?? []).filter((x) => x.businessType === business.type);
  const pending = mine?.find((s) => s.status === 'PENDING');

  const saveCat = async () => {
    setState('saving');
    setState((await save({ categoryId: cat })) ? 'saved' : 'failed');
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || form.name.trim().length < 2) return setErr(t('errName'));
    try {
      await api.post(
        '/category-requests',
        {
          name: form.name.trim(),
          ...(form.nameKh.trim() ? { nameKh: form.nameKh.trim() } : {}),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
        { businessId: business.id },
      );
      setForm(null);
      setErr('');
      await qc.invalidateQueries({ queryKey: key });
    } catch (x) {
      setErr(isApiError(x, 'CONFLICT') ? t('errExists') : t('failed'));
    }
  };
  const withdraw = async (id: string) => {
    await api.delete(`/category-requests/${id}`, { businessId: business.id });
    await qc.invalidateQueries({ queryKey: key });
  };

  return (
    <section className={c.panel} aria-label={t('title')}>
      <div className={c.head}>
        <h2>{t('title')}</h2>
        <p>{t('sub')}</p>
      </div>
      <div className={c.body}>
        <div className={c.row} style={{ alignItems: 'flex-end' }}>
          <label className={c.field} style={{ flex: '1 1 240px' }}>
            <span>{t('current')}</span>
            <select
              value={cat}
              disabled={!canEdit}
              onChange={(e) => {
                setCat(e.target.value);
                setState('idle');
              }}
            >
              {options.map((x) => (
                <option key={x.id} value={x.id}>
                  {label(x)}
                </option>
              ))}
            </select>
          </label>
          {canEdit && cat !== business.categoryId && (
            <button
              type="button"
              className={c.primary}
              disabled={state === 'saving'}
              onClick={() => void saveCat()}
            >
              {state === 'saving' ? t('saving') : t('save')}
            </button>
          )}
        </div>
        {state === 'saved' && (
          <p className={cn(c.status, c.statusOk)} role="status">
            {t('saved')}
          </p>
        )}
        {state === 'failed' && (
          <p className={cn(c.status, c.statusBad)} role="status">
            {t('failed')}
          </p>
        )}

        {canEdit && !pending && !form && (
          <p className={c.muted}>
            {t('missing')}{' '}
            <button
              type="button"
              className={c.ghost}
              onClick={() => setForm({ name: '', nameKh: '', note: '' })}
            >
              {t('suggest')}
            </button>
          </p>
        )}
        {form && (
          <form className={c.suggest} onSubmit={submit} noValidate>
            <div className={c.g2}>
              <label className={c.field}>
                <span>{t('name')}</span>
                <input
                  value={form.name}
                  maxLength={40}
                  placeholder={t('namePh')}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setErr('');
                  }}
                />
              </label>
              <label className={c.field}>
                <span>{t('nameKh')}</span>
                <input
                  value={form.nameKh}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, nameKh: e.target.value })}
                />
              </label>
            </div>
            <label className={c.field}>
              <span>{t('note')}</span>
              <textarea
                rows={2}
                maxLength={300}
                value={form.note}
                placeholder={t('notePh')}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            {err && (
              <p className={c.err} role="alert">
                {err}
              </p>
            )}
            <div className={c.row}>
              <button type="submit" className={c.primary}>
                {t('send')}
              </button>
              <button type="button" className={c.ghost} onClick={() => setForm(null)}>
                {t('cancel')}
              </button>
            </div>
          </form>
        )}

        {!!mine?.length && (
          <ul className={c.requests}>
            {mine.slice(0, 5).map((s) => (
              <li key={s.id}>
                <span className={cn(c.chip, c[`st_${s.status}`])}>{t(`status.${s.status}`)}</span>
                <span>
                  <strong>{s.name}</strong>
                  <span className={c.muted}>
                    {s.status === 'APPROVED' && s.categoryId
                      ? ` · ${t('approvedAs', { name: nameOf(s.categoryId) })}`
                      : ''}
                    {s.decisionNote ? ` · ${s.decisionNote}` : ''}
                    {s.status === 'PENDING'
                      ? ` · ${t('waiting', { name: s.requestedByName })}`
                      : ''}
                  </span>
                </span>
                {s.status === 'PENDING' && canEdit && (
                  <button type="button" className={c.ghost} onClick={() => void withdraw(s.id)}>
                    {t('withdraw')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
