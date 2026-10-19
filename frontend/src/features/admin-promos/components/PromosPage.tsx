'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { adminApi, useAdminAction, usePromos } from '@/features/admin-shared/api';
import {
  Empty,
  Loading,
  PanelError,
  PageHead,
  Pill,
  type Tone,
} from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type {
  PlatformPromo,
  PromoInput,
  PromoState,
  PromoType,
} from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, Ic, s, useUi } from '@/features/seller-shared';
import { api, isApiError } from '@/lib/api';

const STATE_TONE: Record<PromoState, Tone> = {
  ACTIVE: 'ok',
  SCHEDULED: 'info',
  ENDED: 'neutral',
  USED_UP: 'warn',
};

/** `YYYY-MM-DDTHH:mm` (local input) ↔ ISO. */
const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function PromoForm({ promo, onClose }: { promo: PlatformPromo | null; onClose: () => void }) {
  const t = useTranslations('admin.promos');
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const { data: cats = [] } = useQuery({
    queryKey: ['meta', 'categories'],
    queryFn: () =>
      api.get<{ id: string; name: string; inMarketplace: boolean }[]>('/meta/categories'),
    staleTime: 60 * 60_000,
  });
  const now = new Date();
  const [f, setF] = useState({
    name: promo?.name ?? '',
    code: promo?.code ?? '',
    type: (promo?.type ?? 'PERCENT') as PromoType,
    value: String(promo?.value ?? 10),
    scope: (promo?.scope === 'CATEGORY' ? 'CATEGORY' : 'ALL') as 'ALL' | 'CATEGORY',
    targetIds: promo?.targetIds ?? [],
    minSpend: String(promo?.minSpend ?? ''),
    maxDiscount: String(promo?.maxDiscount ?? ''),
    usageLimit: String(promo?.usageLimit ?? ''),
    startsAt: toLocal(promo?.startsAt ?? now.toISOString()),
    endsAt: toLocal(promo?.endsAt ?? new Date(now.getTime() + 7 * 86_400_000).toISOString()),
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string | string[]) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input: PromoInput = {
      name: f.name.trim(),
      code: f.code.trim().toUpperCase(),
      type: f.type,
      value: f.type === 'FREE_SHIPPING' ? 0 : Number(f.value),
      scope: f.scope,
      targetIds: f.scope === 'CATEGORY' ? f.targetIds : [],
      minSpend: Number(f.minSpend || 0),
      maxDiscount: Number(f.maxDiscount || 0),
      usageLimit: Number(f.usageLimit || 0),
      startsAt: new Date(f.startsAt).toISOString(),
      endsAt: new Date(f.endsAt).toISOString(),
    };
    try {
      await run.mutateAsync(() =>
        promo ? adminApi.updatePromo(promo.id, input) : adminApi.createPromo(input),
      );
      useUi.getState().showToast(promo ? t('saved') : t('created'));
      onClose();
    } catch (x) {
      const field = isApiError(x, 'VALIDATION_FAILED') ? (x.details[0]?.field ?? 'name') : 'name';
      const known = isApiError(x, 'VALIDATION_FAILED') && t.has(`err.${field}` as 'err.name');
      setErr({
        [known ? field : 'name']: known ? t(`err.${field}` as 'err.name') : t('err.failed'),
      });
    }
  };
  const field = (k: string, label: string, input: React.ReactNode, hint?: string) => (
    <div className={cx(s.field, err[k] && s.bad)}>
      <label htmlFor={`pr-${k}`}>{label}</label>
      {input}
      {hint && <span className={s.hint}>{hint}</span>}
      <div className={s.err}>{err[k]}</div>
    </div>
  );
  return (
    <div className={s.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={cx(s.modal, s.wide)}
        role="dialog"
        aria-modal="true"
        aria-label={t(promo ? 'edit' : 'new')}
        onSubmit={submit}
      >
        <button type="button" className={s.close} aria-label={t('close')} onClick={onClose}>
          <Ic name="x" size={18} />
        </button>
        <h2>{t(promo ? 'edit' : 'new')}</h2>
        <div className={s.g2}>
          {field(
            'name',
            t('f.name'),
            <input id="pr-name" value={f.name} onChange={(e) => set('name', e.target.value)} />,
          )}
          {field(
            'code',
            t('f.code'),
            <input
              id="pr-code"
              value={f.code}
              style={{ fontFamily: 'var(--f-mono)', textTransform: 'uppercase' }}
              onChange={(e) => set('code', e.target.value)}
            />,
            t('f.codeHint'),
          )}
        </div>
        <div className={s.g2}>
          {field(
            'type',
            t('f.type'),
            <select id="pr-type" value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="PERCENT">{t('type.PERCENT')}</option>
              <option value="FIXED">{t('type.FIXED')}</option>
              <option value="FREE_SHIPPING">{t('type.FREE_SHIPPING')}</option>
            </select>,
          )}
          {f.type !== 'FREE_SHIPPING' &&
            field(
              'value',
              f.type === 'PERCENT' ? t('f.percent') : t('f.amount'),
              <input
                id="pr-value"
                inputMode="decimal"
                value={f.value}
                onChange={(e) => set('value', e.target.value)}
              />,
            )}
        </div>
        {field(
          'scope',
          t('f.scope'),
          <select id="pr-scope" value={f.scope} onChange={(e) => set('scope', e.target.value)}>
            <option value="ALL">{t('scope.ALL')}</option>
            <option value="CATEGORY">{t('scope.CATEGORY')}</option>
          </select>,
        )}
        {f.scope === 'CATEGORY' && (
          <div className={cx(s.field, err.targetIds && s.bad)}>
            <span>{t('f.categories')}</span>
            <div className={s.chips}>
              {cats
                .filter((c) => c.inMarketplace)
                .map((c) => {
                  const on = f.targetIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={cx(s.chip, on && s.on)}
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'targetIds',
                          on ? f.targetIds.filter((x) => x !== c.id) : [...f.targetIds, c.id],
                        )
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
            </div>
            <div className={s.err}>{err.targetIds}</div>
          </div>
        )}
        <div className={s.g3}>
          {field(
            'minSpend',
            t('f.minSpend'),
            <input
              id="pr-minSpend"
              inputMode="decimal"
              value={f.minSpend}
              onChange={(e) => set('minSpend', e.target.value)}
              placeholder="0"
            />,
          )}
          {field(
            'maxDiscount',
            t('f.maxDiscount'),
            <input
              id="pr-maxDiscount"
              inputMode="decimal"
              value={f.maxDiscount}
              onChange={(e) => set('maxDiscount', e.target.value)}
              placeholder="0"
            />,
          )}
          {field(
            'usageLimit',
            t('f.usageLimit'),
            <input
              id="pr-usageLimit"
              inputMode="numeric"
              value={f.usageLimit}
              onChange={(e) => set('usageLimit', e.target.value)}
              placeholder="0"
            />,
          )}
        </div>
        <div className={s.g2}>
          {field(
            'startsAt',
            t('f.startsAt'),
            <input
              id="pr-startsAt"
              type="datetime-local"
              value={f.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
            />,
          )}
          {field(
            'endsAt',
            t('f.endsAt'),
            <input
              id="pr-endsAt"
              type="datetime-local"
              value={f.endsAt}
              onChange={(e) => set('endsAt', e.target.value)}
            />,
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className={cx(s.btn, s.btnGhost)} onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={run.isPending}>
            {t(promo ? 'save' : 'create')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** `/admin/promos`: VirtualBiz's own promo codes (any shop, or chosen categories). */
export function PromosPage() {
  const t = useTranslations('admin.promos');
  const f = useAdminFmt();
  const { data, isPending, error, refetch } = usePromos();
  const [editing, setEditing] = useState<PlatformPromo | null | undefined>(undefined);
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const end = (p: PlatformPromo) =>
    act({
      title: t('endTitle', { code: p.code }),
      body: t('endBody'),
      ok: t('end'),
      danger: true,
      done: t('ended'),
      run: () => run.mutateAsync(() => adminApi.endPromo(p.id)),
    });
  const value = (p: PlatformPromo) =>
    p.type === 'PERCENT'
      ? `${p.value}%`
      : p.type === 'FIXED'
        ? f.money(p.value)
        : t('type.FREE_SHIPPING');
  return (
    <>
      <PageHead
        title={t('title')}
        sub={t('sub')}
        actions={
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary)}
            onClick={() => setEditing(null)}
          >
            <Ic name="plus" size={18} />
            {t('new')}
          </button>
        }
      />
      <section className={s.panel}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : !data?.length ? (
          <Empty title={t('empty')} sub={t('emptySub')} />
        ) : (
          <div className={s.tblWrap}>
            <table>
              <thead>
                <tr>
                  <th>{t('col.code')}</th>
                  <th>{t('col.offer')}</th>
                  <th>{t('col.when')}</th>
                  <th className={s.r}>{t('col.uses')}</th>
                  <th>{t('col.state')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className={s.codeTag}>{p.code}</span>
                      <span className={cx(s.tiny, s.muted, s.block)}>{p.name}</span>
                    </td>
                    <td>
                      {value(p)}
                      <span className={cx(s.tiny, s.muted, s.block)}>
                        {p.scope === 'CATEGORY'
                          ? t('onCategories', { list: p.targetIds.join(', ') })
                          : t('scope.ALL')}
                        {p.minSpend ? ` · ${t('minSpend', { amount: f.money(p.minSpend) })}` : ''}
                      </span>
                    </td>
                    <td className={s.num}>
                      {f.date(p.startsAt)} – {f.date(p.endsAt)}
                    </td>
                    <td className={cx(s.r, s.num)}>
                      {p.uses}
                      {p.usageLimit ? ` / ${p.usageLimit}` : ''}
                    </td>
                    <td>
                      <Pill tone={STATE_TONE[p.state]}>{t(`state.${p.state}`)}</Pill>
                    </td>
                    <td className={s.r} style={{ whiteSpace: 'nowrap' }}>
                      {p.state !== 'ENDED' && (
                        <>
                          <button
                            type="button"
                            className={cx(s.btn, s.btnGhost, s.btnSm)}
                            onClick={() => setEditing(p)}
                          >
                            {t('edit')}
                          </button>{' '}
                          <button
                            type="button"
                            className={cx(s.btn, s.btnGhost, s.btnSm)}
                            onClick={() => void end(p)}
                          >
                            {t('end')}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && <PromoForm promo={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
