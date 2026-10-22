'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { adminApi, useAdminAction, useCategories, useSettings } from '@/features/admin-shared/api';
import { Loading, PageHead, PanelError } from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import type { AdminCategory, CategoryInput } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, Ic, s, Switch, useUi } from '@/features/seller-shared';
import { Ic as ShopIc, isIcName } from '@/features/shop-shared/components/Ic';
import { isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { formatKhr, usdToKhr } from '@/lib/money';
import type { BusinessType } from '@/lib/domain';

import c from './settings.module.css';
import { CategorySuggestions } from './CategorySuggestions';
import { StaffTab } from './StaffTab';

const KEYS = ['tab'] as const;
const DELAYS = [0, 1, 2, 3, 5, 7, 10, 14];
/** Icons the marketplace can draw for a category. */
const ICONS = [
  'cup',
  'phone',
  'shirt',
  'basket',
  'leaf',
  'brush',
  'scissors',
  'wrench',
  'heart',
  'home',
  'star',
  'truck',
  'shield',
  'clock',
  'store',
  'tag',
  'calendar',
  'card',
  'gear',
  'cart',
  'user',
  'map',
] as const;
const TINTS = [1, 2, 3, 4, 5, 6] as const;
const tintClass = (n: number) => c[`t${n}` as 't1'];

const useIsSuper = () => useSession().user?.platformRole === 'SUPER_ADMIN';

/** `/admin/settings`: the platform's numbers and the marketplace's categories. */
export function SettingsPage() {
  const t = useTranslations('admin.settings');
  const { values, set } = useListParams(KEYS);
  const tab =
    values.tab === 'categories' || values.tab === 'staff' ? values.tab : ('platform' as const);
  return (
    <>
      <PageHead title={t('title')} sub={t('sub')} />
      <div className={cx(s.tabs, c.tabs)} role="tablist">
        {(['platform', 'categories', 'staff'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={cx(tab === k && s.on)}
            onClick={() => set({ tab: k === 'platform' ? '' : k })}
          >
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'platform' ? (
        <PlatformTab />
      ) : tab === 'categories' ? (
        <CategoriesTab />
      ) : (
        <StaffTab />
      )}
    </>
  );
}

function ReadOnlyNote() {
  const t = useTranslations('admin.settings');
  return (
    <div className={c.note}>
      <Ic name="alert" size={16} />
      {t('readOnly')}
    </div>
  );
}

// ── Platform ─────────────────────────────────────────────────────────────────────────

function PlatformTab() {
  const t = useTranslations('admin.settings');
  const f = useAdminFmt();
  const isSuper = useIsSuper();
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const { data, error, refetch } = useSettings();
  const [form, setForm] = useState({ commission: '', delay: '1', rate: '' });
  const [err, setErr] = useState<Record<string, string>>({});

  // Fill the form from the server (again after a save or a change elsewhere).
  useEffect(() => {
    if (data)
      setForm({
        commission: String(Number(data.commissionPct)),
        delay: String(data.payoutDelayDays),
        rate: String(data.khrPerUsd),
      });
  }, [data]);

  if (error && !data) return <PanelError error={error} retry={() => void refetch()} />;
  if (!data) return <Loading />;

  const pct = Number(form.commission);
  const rate = Number(form.rate.replace(/[^\d]/g, ''));
  const delay = Number(form.delay);
  const dirty = {
    commission: pct !== Number(data.commissionPct),
    delay: delay !== data.payoutDelayDays,
    rate: rate !== data.khrPerUsd,
  };
  const anyDirty = dirty.commission || dirty.delay || dirty.rate;
  const okPct =
    form.commission.trim() !== '' &&
    pct >= 0 &&
    pct <= 30 &&
    /^\d+(\.\d{1,2})?$/.test(form.commission.trim());
  const okRate = rate >= 1000 && rate <= 10000;
  const delayLabel = (d: number) => (d === 0 ? t('delay0') : t('delayN', { n: d }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const bad = {
      ...(okPct ? {} : { commission: t('errCommission') }),
      ...(okRate ? {} : { rate: t('errRate') }),
    };
    setErr(bad);
    if (Object.keys(bad).length || !anyDirty) return;
    const lines = [
      dirty.commission && t('chCommission', { from: Number(data.commissionPct), to: pct }),
      dirty.delay &&
        t('chDelay', { from: delayLabel(data.payoutDelayDays), to: delayLabel(delay) }),
      dirty.rate && t('chRate', { from: f.int(data.khrPerUsd), to: f.int(rate) }),
    ].filter(Boolean);
    await act({
      title: t('confirmTitle'),
      body: lines.join('\n'),
      ok: t('save'),
      done: t('saved'),
      run: () =>
        run.mutateAsync(() =>
          adminApi.updateSettings({ commissionPct: pct, payoutDelayDays: delay, khrPerUsd: rate }),
        ),
    });
  };

  return (
    <>
      {!isSuper && <ReadOnlyNote />}
      <form className={s.panel} onSubmit={save} noValidate>
        <fieldset disabled={!isSuper} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className={c.row}>
            <div>
              <h3>{t('commission')}</h3>
              <p>{t('commissionHelp')}</p>
            </div>
            <div className={cx(c.ctl, err.commission && c.bad)}>
              <div className={c.unit}>
                <input
                  id="set-commission"
                  inputMode="decimal"
                  aria-label={t('commission')}
                  value={form.commission}
                  onChange={(e) => setForm((x) => ({ ...x, commission: e.target.value.trim() }))}
                />
                <span>%</span>
              </div>
              {err.commission && <span className={c.err}>{err.commission}</span>}
              {okPct && (
                <span className={c.example}>
                  {t.rich('commissionExample', {
                    fee: f.money(pct),
                    shop: f.money(100 - pct),
                    b: (x) => <b>{x}</b>,
                  })}
                </span>
              )}
              {dirty.commission && <span className={c.changed}>{t('changedHint')}</span>}
            </div>
          </div>
          <div className={c.row}>
            <div>
              <h3>{t('delay')}</h3>
              <p>{t('delayHelp')}</p>
            </div>
            <div className={c.ctl}>
              <div className={c.unit}>
                <select
                  aria-label={t('delay')}
                  value={form.delay}
                  onChange={(e) => setForm((x) => ({ ...x, delay: e.target.value }))}
                >
                  {[...new Set([...DELAYS, data.payoutDelayDays])]
                    .sort((a, b) => a - b)
                    .map((d) => (
                      <option key={d} value={d}>
                        {delayLabel(d)}
                      </option>
                    ))}
                </select>
              </div>
              {dirty.delay && <span className={c.changed}>{t('changedHint')}</span>}
            </div>
          </div>
          <div className={c.row}>
            <div>
              <h3>{t('rate')}</h3>
              <p>{t('rateHelp')}</p>
            </div>
            <div className={cx(c.ctl, err.rate && c.bad)}>
              <div className={c.unit}>
                <input
                  inputMode="numeric"
                  aria-label={t('rate')}
                  value={form.rate}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, rate: e.target.value.replace(/[^\d]/g, '') }))
                  }
                />
                <span>{t('rateUnit')}</span>
              </div>
              {err.rate && <span className={c.err}>{err.rate}</span>}
              {okRate && (
                <span className={c.example}>
                  {t.rich('rateExample', {
                    one: formatKhr(usdToKhr(1, rate)),
                    price: formatKhr(usdToKhr(12.5, rate)),
                    b: (x) => <b>{x}</b>,
                  })}
                </span>
              )}
            </div>
          </div>
        </fieldset>
        <div className={c.foot}>
          <span>
            {data.updatedBy
              ? t('lastChanged', { name: data.updatedBy, when: f.dateTime(data.updatedAt) })
              : t('neverChanged')}
          </span>
          {isSuper && (
            <span className={c.btns}>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost)}
                disabled={!anyDirty}
                onClick={() => {
                  setErr({});
                  setForm({
                    commission: String(Number(data.commissionPct)),
                    delay: String(data.payoutDelayDays),
                    rate: String(data.khrPerUsd),
                  });
                }}
              >
                {t('discard')}
              </button>
              <button
                type="submit"
                className={cx(s.btn, s.btnPrimary)}
                disabled={!anyDirty || run.isPending}
              >
                {t('save')}
              </button>
            </span>
          )}
        </div>
      </form>
    </>
  );
}

// ── Categories ───────────────────────────────────────────────────────────────────────

function CategoriesTab() {
  const t = useTranslations('admin.settings');
  const locale = useLocale();
  const isSuper = useIsSuper();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const { data, error, refetch } = useCategories();
  const [editing, setEditing] = useState<
    { cat: AdminCategory | null; type: BusinessType } | undefined
  >(undefined);
  if (error && !data) return <PanelError error={error} retry={() => void refetch()} />;
  if (!data) return <Loading />;

  const fail = () => useUi.getState().showToast(t('catFailed'));
  const toggle = (x: AdminCategory, on: boolean) =>
    run
      .mutateAsync(() => adminApi.updateCategory(x.id, { inMarketplace: on }))
      .then(() =>
        useUi
          .getState()
          .showToast(
            t(on ? 'catShown' : 'catHidden', { name: locale === 'kh' ? x.nameKh : x.name }),
          ),
      )
      .catch(fail);
  /** Swap a category with its neighbour of the same type, keeping everything else in place. */
  const move = (x: AdminCategory, dir: -1 | 1) => {
    const same = data.filter((y) => y.businessType === x.businessType);
    const i = same.findIndex((y) => y.id === x.id);
    const other = same[i + dir];
    if (!other) return;
    const ids = data.map((y) => y.id);
    const a = ids.indexOf(x.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
    void run.mutateAsync(() => adminApi.reorderCategories(ids)).catch(fail);
  };

  return (
    <>
      <CategorySuggestions categories={data} isSuper={isSuper} />
      {!isSuper && <ReadOnlyNote />}
      {(['PRODUCT', 'SERVICE'] as const).map((type) => {
        const list = data.filter((x) => x.businessType === type);
        return (
          <section key={type} className={s.panel} style={{ marginBottom: 16 }}>
            <div className={s.panelH}>
              <h2>
                {t(type === 'PRODUCT' ? 'catProduct' : 'catService')}{' '}
                <span className={cx(s.muted, s.num)} style={{ fontWeight: 400 }}>
                  {list.length}
                </span>
              </h2>
              {isSuper && (
                <button
                  type="button"
                  className={cx(s.btn, s.btnGhost, s.btnSm)}
                  onClick={() => setEditing({ cat: null, type })}
                >
                  <Ic name="plus" size={16} />
                  {t('catAdd')}
                </button>
              )}
            </div>
            <div className={s.tblWrap}>
              <table className={c.catTable}>
                <colgroup>
                  <col />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 190 }} />
                  <col style={{ width: isSuper ? 120 : 0 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{t('thCategory')}</th>
                    <th className={s.r}>{t('thShops')}</th>
                    <th>{t('thMarketplace')}</th>
                    <th aria-label={t('thActions')} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((x, i) => (
                    <tr key={x.id} className={cx(!x.inMarketplace && c.hiddenRow)}>
                      <td>
                        <span className={c.cat}>
                          <span className={cx(c.tile, tintClass(x.tint))}>
                            {isIcName(x.icon) && <ShopIc name={x.icon} size={20} />}
                          </span>
                          <span className={c.catName} style={{ minWidth: 0 }}>
                            <strong>{locale === 'kh' ? x.nameKh : x.name}</strong>
                            <span>{locale === 'kh' ? x.name : x.nameKh}</span>
                          </span>
                        </span>
                      </td>
                      <td className={cx(s.r, s.num)}>{x.shops}</td>
                      <td>
                        <span className={c.mk}>
                          {isSuper && (
                            <Switch
                              checked={x.inMarketplace}
                              label={t('catShowLabel', { name: x.name })}
                              onChange={(on) => void toggle(x, on)}
                            />
                          )}
                          {x.inMarketplace ? t('catVisible') : t('catOff')}
                        </span>
                      </td>
                      <td>
                        {isSuper && (
                          <span className={c.acts}>
                            <button
                              type="button"
                              className={c.act}
                              aria-label={t('moveUp', { name: x.name })}
                              title={t('moveUp', { name: x.name })}
                              disabled={i === 0 || run.isPending}
                              onClick={() => move(x, -1)}
                            >
                              <span className={c.up}>
                                <Ic name="left" size={16} />
                              </span>
                            </button>
                            <button
                              type="button"
                              className={c.act}
                              aria-label={t('moveDown', { name: x.name })}
                              title={t('moveDown', { name: x.name })}
                              disabled={i === list.length - 1 || run.isPending}
                              onClick={() => move(x, 1)}
                            >
                              <span className={c.down}>
                                <Ic name="left" size={16} />
                              </span>
                            </button>
                            <button
                              type="button"
                              className={c.act}
                              aria-label={t('catEdit', { name: x.name })}
                              title={t('catEdit', { name: x.name })}
                              onClick={() => setEditing({ cat: x, type })}
                            >
                              <Ic name="edit" size={16} />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {editing && (
        <CategoryForm cat={editing.cat} type={editing.type} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}

function CategoryForm({
  cat,
  type,
  onClose,
}: {
  cat: AdminCategory | null;
  type: BusinessType;
  onClose: () => void;
}) {
  const t = useTranslations('admin.settings');
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const [f, setF] = useState({
    name: cat?.name ?? '',
    nameKh: cat?.nameKh ?? '',
    icon: cat?.icon ?? 'store',
    tint: cat?.tint ?? 1,
    inMarketplace: cat?.inMarketplace ?? true,
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad: Record<string, string> = {};
    if (f.name.trim().length < 2) bad.name = t('errName');
    if (f.nameKh.trim().length < 2) bad.nameKh = t('errName');
    setErr(bad);
    if (Object.keys(bad).length) return;
    const input: CategoryInput = {
      name: f.name.trim(),
      nameKh: f.nameKh.trim(),
      icon: f.icon,
      tint: f.tint,
      inMarketplace: f.inMarketplace,
      ...(cat ? {} : { businessType: type }),
    };
    try {
      await run.mutateAsync(() =>
        cat ? adminApi.updateCategory(cat.id, input) : adminApi.createCategory(input),
      );
      useUi.getState().showToast(cat ? t('catSaved') : t('catCreated', { name: input.name! }));
      onClose();
    } catch (x) {
      setErr(isApiError(x, 'CONFLICT') ? { name: t('errDup') } : { name: t('catFailed') });
    }
  };

  const field = (k: 'name' | 'nameKh', label: string) => (
    <div className={cx(s.field, err[k] && s.bad)}>
      <label htmlFor={`cat-${k}`}>{label}</label>
      <input id={`cat-${k}`} maxLength={40} value={f[k]} onChange={(e) => set(k, e.target.value)} />
      <div className={s.err}>{err[k]}</div>
    </div>
  );

  return (
    <div className={s.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={cat ? t('catEditTitle') : t('catNewTitle')}
        onSubmit={submit}
        noValidate
      >
        <button type="button" className={s.close} aria-label={t('close')} onClick={onClose}>
          <Ic name="x" size={18} />
        </button>
        <h2>{cat ? t('catEditTitle') : t('catNewTitle')}</h2>
        <p className={cx(s.small, s.muted)} style={{ marginTop: -6 }}>
          {t(type === 'PRODUCT' ? 'catForProduct' : 'catForService')}
        </p>
        <div className={s.g2}>
          {field('name', t('nameEn'))}
          {field('nameKh', t('nameKh'))}
        </div>
        <div className={s.field}>
          <span className={s.lbl}>{t('icon')}</span>
          <div className={c.icons} role="group" aria-label={t('icon')}>
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={c.iconBtn}
                aria-pressed={f.icon === ic}
                aria-label={ic}
                onClick={() => set('icon', ic)}
              >
                <ShopIc name={ic} size={18} />
              </button>
            ))}
          </div>
        </div>
        <div className={s.field}>
          <span className={s.lbl}>{t('colour')}</span>
          <div className={c.tints} role="group" aria-label={t('colour')}>
            {TINTS.map((n) => (
              <button
                key={n}
                type="button"
                className={cx(c.tintBtn, tintClass(n))}
                aria-pressed={f.tint === n}
                aria-label={t('colourN', { n })}
                onClick={() => set('tint', n)}
              />
            ))}
          </div>
        </div>
        <div className={c.preview}>
          <span className={cx(c.tile, tintClass(f.tint))}>
            {isIcName(f.icon) && <ShopIc name={f.icon} size={20} />}
          </span>
          <span>
            <strong>{f.name.trim() || t('nameEn')}</strong>
            <small>{f.nameKh.trim() || t('nameKh')}</small>
          </span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch
            checked={f.inMarketplace}
            label={t('catShowInMarket')}
            onChange={(v) => set('inMarketplace', v)}
          />
          <span>
            {t('catShowInMarket')}
            <span className={cx(s.hint, s.block)}>{t('catShowHint')}</span>
          </span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className={cx(s.btn, s.btnGhost)} onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={run.isPending}>
            {cat ? t('save') : t('catAdd')}
          </button>
        </div>
      </form>
    </div>
  );
}
