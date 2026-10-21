'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cx, Ic, Modal, s, useDb, useUi } from '@/features/seller-shared';
import { api, isApiError } from '@/lib/api';

import c from './collections.module.css';

interface Row {
  id: string;
  name: string;
  productCount: number;
}

/**
 * The shop's collections (docs/api/phase12-catalog-structure.md): add, rename, reorder and
 * delete, choosing where a deleted collection's products go. The catalogue reloads after each.
 */
export function CollectionsDialog() {
  const t = useTranslations('seller.collections');
  const id = useDb().shop.id;
  const qc = useQueryClient();
  const opts = { businessId: id };
  const key = ['seller', 'collections', id];
  const { data, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Row[]>('/catalog/collections', opts),
  });
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<Row | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useUi((u) => u.showToast);

  const run = async (fn: () => Promise<Row[]>, done?: string) => {
    setBusy(true);
    setErr('');
    try {
      qc.setQueryData(key, await fn());
      void qc.invalidateQueries({ queryKey: ['seller', 'catalog', id] });
      if (done) toast(done);
      return true;
    } catch (e) {
      setErr(
        isApiError(e, 'CONFLICT')
          ? t('errTaken')
          : isApiError(e, 'VALIDATION_FAILED')
            ? t('errName')
            : isApiError(e, 'FORBIDDEN')
              ? t('errRole')
              : t('failed'),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const rows = data ?? [];
  const move = (i: number, dir: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    [ids[i], ids[i + dir]] = [ids[i + dir]!, ids[i]!];
    void run(() => api.put<Row[]>('/catalog/collections/order', ids, opts));
  };
  const rename = (r: Row) => {
    const next = (edit[r.id] ?? r.name).trim();
    if (next === r.name) return;
    void run(
      () => api.patch<Row[]>(`/catalog/collections/${r.id}`, { name: next }, opts),
      t('renamed', { name: next }),
    ).then((ok) => !ok && setEdit((x) => ({ ...x, [r.id]: r.name })));
  };

  return (
    <Modal label={t('title')}>
      <h2>{t('title')}</h2>
      <p className={cx(s.small, s.muted)} style={{ marginTop: -6 }}>
        {t('sub')}
      </p>
      {error && !data ? (
        <p className={s.err}>
          {t('loadFailed')}{' '}
          <button type="button" className={s.link} onClick={() => void refetch()}>
            {t('retry')}
          </button>
        </p>
      ) : (
        <ul className={c.list}>
          {rows.map((r, i) => (
            <li key={r.id} className={c.row}>
              <input
                aria-label={t('nameOf', { name: r.name })}
                value={edit[r.id] ?? r.name}
                maxLength={40}
                onChange={(e) => setEdit((x) => ({ ...x, [r.id]: e.target.value }))}
                onBlur={() => rename(r)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              <span className={c.count}>{t('products', { n: r.productCount })}</span>
              <span className={c.acts}>
                <button
                  type="button"
                  className={c.act}
                  aria-label={t('up', { name: r.name })}
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={c.act}
                  aria-label={t('down', { name: r.name })}
                  disabled={busy || i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={cx(c.act, c.danger)}
                  aria-label={t('delete', { name: r.name })}
                  disabled={busy}
                  onClick={() => {
                    setRemoving(r);
                    setMoveTo('');
                  }}
                >
                  <Ic name="trash" size={16} />
                </button>
              </span>
            </li>
          ))}
          {!rows.length && data && <li className={cx(s.small, s.muted)}>{t('empty')}</li>}
        </ul>
      )}

      {removing && (
        <div
          className={c.confirm}
          role="group"
          aria-label={t('deleteTitle', { name: removing.name })}
        >
          <strong>{t('deleteTitle', { name: removing.name })}</strong>
          {removing.productCount > 0 ? (
            <label className={s.field}>
              <span>{t('moveLabel', { n: removing.productCount })}</span>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">{t('moveNone')}</option>
                {rows
                  .filter((r) => r.id !== removing.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <span className={cx(s.small, s.muted)}>{t('deleteEmpty')}</span>
          )}
          <div className={c.btns}>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost, s.btnSm)}
              onClick={() => setRemoving(null)}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnDanger, s.btnSm)}
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    api.delete<Row[]>(
                      `/catalog/collections/${removing.id}${moveTo ? `?moveTo=${moveTo}` : ''}`,
                      opts,
                    ),
                  t('deleted', { name: removing.name }),
                ).then((ok) => ok && setRemoving(null))
              }
            >
              {t('deleteOk')}
            </button>
          </div>
        </div>
      )}

      <form
        className={c.add}
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (n.length < 2) return setErr(t('errName'));
          void run(
            () => api.post<Row[]>('/catalog/collections', { name: n }, opts),
            t('added', { name: n }),
          ).then((ok) => ok && setName(''));
        }}
      >
        <input
          aria-label={t('newName')}
          placeholder={t('newName')}
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            setErr('');
          }}
        />
        <button type="submit" className={cx(s.btn, s.btnPrimary, s.btnSm)} disabled={busy}>
          <Ic name="plus" size={16} />
          {t('add')}
        </button>
      </form>
      {err && (
        <p className={s.err} role="alert">
          {err}
        </p>
      )}
    </Modal>
  );
}
