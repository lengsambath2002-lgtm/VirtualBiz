'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { EmptyRow } from '@/components/feedback';
import {
  cx,
  DAY,
  Ic,
  Modal,
  s,
  today0,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  type SellerProduct,
  useCollectionName,
} from '@/features/seller-shared';
import type { Promotion, PromotionState } from '@/lib/domain';
import { promotionState } from '@/lib/pricing';

const STATE_PILL: Record<PromotionState, string> = {
  ACTIVE: 'ok',
  SCHEDULED: 'info',
  USED_UP: 'neutral',
  ENDED: 'neutral',
};

/** States are judged against local midnight, like the prototype's `today0`. */
const stateOf = (p: Promotion) => promotionState(p, new Date(today0()));

type Desc = Pick<Promotion, 'type' | 'value' | 'scope' | 'targetIds' | 'minSpend'>;

function useDescribe() {
  const t = useTranslations('seller.promotions.desc');
  const tcol = useCollectionName();
  const db = useDb();
  return (p: Desc) => {
    const what =
      p.type === 'PERCENT'
        ? t('pct', { v: p.value })
        : p.type === 'FIXED'
          ? t('fixed', { v: p.value })
          : t('ship');
    const scope =
      p.scope === 'ALL'
        ? t('everything')
        : p.scope === 'CATEGORY'
          ? p.targetIds.map((c) => tcol(c)).join(', ')
          : p.targetIds.map((id) => db.products.find((x) => x.id === id)?.title ?? '').join(', ');
    return `${what} ${scope}${p.minSpend ? t('min', { v: p.minSpend }) : ''}`;
  };
}

export function PromotionsPage() {
  const t = useTranslations('seller.promotions');
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  const describe = useDescribe();
  const open = (id?: string) => useUi.getState().open({ kind: 'promo', ...(id ? { id } : {}) });

  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('title')}</h1>
          <p className={s.muted}>{t('sub')}</p>
        </div>
        <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={() => open()}>
          <Ic name="plus" size={18} />
          {t('create')}
        </button>
      </div>
      <section className={s.panel}>
        <div className={s.tblWrap}>
          <table>
            <thead>
              <tr>
                <th>{t('col.promo')}</th>
                <th>{t('col.method')}</th>
                <th>{t('col.status')}</th>
                <th>{t('col.dates')}</th>
                <th className={s.r}>{t('col.used')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!db.promos.length && (
                <EmptyRow cols={6} title={t('emptyTitle')} body={t('emptyBody')} />
              )}
              {db.promos.map((p) => {
                const st = stateOf(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{p.name}</b>
                      <div className={cx(s.tiny, s.muted)}>{describe(p)}</div>
                    </td>
                    <td>
                      {p.code ? (
                        <code className={s.codeTag}>{p.code}</code>
                      ) : (
                        <span className={cx(s.pill, s.neutral)}>{t('automatic')}</span>
                      )}
                    </td>
                    <td>
                      <span className={cx(s.pill, s[STATE_PILL[st]])}>{t(`state.${st}`)}</span>
                    </td>
                    <td className={cx(s.num, s.small)}>
                      {f.fmtD(p.startsAt)} – {f.fmtD(p.endsAt)}
                    </td>
                    <td className={cx(s.r, s.num)}>
                      {p.uses}
                      {p.usageLimit ? ` / ${p.usageLimit}` : ''}
                    </td>
                    <td className={s.r} style={{ whiteSpace: 'nowrap' }}>
                      {st === 'ACTIVE' && (
                        <button
                          type="button"
                          className={cx(s.btn, s.btnGhost, s.btnSm)}
                          onClick={async () => {
                            const prev = await useSellerStore.getState().endPromo(p.id);
                            if (!prev) return;
                            useUi.getState().showToast(t('ended', { name: p.name }), {
                              label: tc('undo'),
                              fn: () => void useSellerStore.getState().restorePromoEnd(p.id, prev),
                            });
                          }}
                        >
                          {t('endNow')}
                        </button>
                      )}
                      <button
                        type="button"
                        className={s.ibtn}
                        aria-label={t('edit', { name: p.name })}
                        onClick={() => open(p.id)}
                      >
                        <Ic name="edit" size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fromIso = (v: string) => {
  const [y = 0, m = 1, d = 1] = v.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export function PromoForm({ id }: { id?: string }) {
  const t = useTranslations('seller.promotions.form');
  const tcol = useCollectionName();
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  const describe = useDescribe();
  const src = id ? db.promos.find((x) => x.id === id) : undefined;
  const t0 = today0();
  const [name, setName] = useState(src?.name ?? '');
  const [how, setHow] = useState<'code' | 'auto'>(src && src.code === null ? 'auto' : 'code');
  const [code, setCode] = useState(src?.code ?? '');
  const [type, setType] = useState<Promotion['type']>(src?.type ?? 'PERCENT');
  const [value, setValue] = useState(String(src?.value ?? 10));
  const [scope, setScope] = useState<Promotion['scope']>(src?.scope ?? 'ALL');
  const [targets, setTargets] = useState<string[]>(src?.targetIds ?? []);
  const [min, setMin] = useState(src?.minSpend ? String(src.minSpend) : '');
  const [start, setStart] = useState(isoDay(src ? Date.parse(src.startsAt) : t0));
  const [end, setEnd] = useState(isoDay(src ? Date.parse(src.endsAt) : t0 + 14 * DAY));
  const [limit, setLimit] = useState(src?.usageLimit ? String(src.usageLimit) : '');
  const [errs, setErrs] = useState<Record<string, string>>({});

  const read = () => {
    const v = parseFloat(value) || 0;
    const m = parseFloat(min) || 0;
    const lim = parseInt(limit, 10) || 0;
    return {
      name: name.trim(),
      code: how === 'code' ? code.trim().toUpperCase() : null,
      type,
      value: v,
      scope,
      targetIds: targets,
      minSpend: m,
      start: fromIso(start),
      end: fromIso(end),
      limit: lim,
    };
  };
  const r = read();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {
      pn: r.name.length < 2 ? t('err.name') : '',
      pc:
        r.code === null
          ? ''
          : !/^[A-Z0-9]{4,16}$/.test(r.code)
            ? t('err.code')
            : db.promos.some((x) => x.id !== id && x.code === r.code)
              ? t('err.codeExists')
              : '',
      pv:
        r.type === 'FREE_SHIPPING'
          ? ''
          : !(r.value > 0)
            ? t('err.value')
            : r.type === 'PERCENT' && r.value >= 100
              ? t('err.pct')
              : '',
      tg: r.scope !== 'ALL' && !r.targetIds.length ? t('err.targets') : '',
      p2: r.end < r.start ? t('err.endBefore') : r.end < t0 ? t('err.endPast') : '',
    };
    setErrs(e2);
    if (Object.values(e2).some(Boolean)) return;
    const promo: Promotion = {
      id: src?.id ?? '',
      businessId: db.shop.id,
      name: r.name,
      type: r.type,
      value: r.value,
      code: r.code,
      scope: r.scope,
      targetIds: r.targetIds,
      ...(r.minSpend ? { minSpend: r.minSpend } : {}),
      ...(src?.maxDiscount ? { maxDiscount: src.maxDiscount } : {}),
      startsAt: new Date(r.start).toISOString(),
      endsAt: new Date(r.end).toISOString(),
      uses: src?.uses ?? 0,
      ...(r.limit ? { usageLimit: r.limit } : {}),
    };
    if (!(await useSellerStore.getState().savePromo(promo, !src))) return;
    const ui = useUi.getState();
    ui.close(true);
    ui.showToast(r.start > t0 ? t('scheduled', { date: f.fmtD(r.start) }) : t('live'));
  };

  const products: SellerProduct[] = db.products;
  const fieldCls = (k: string) => cx(s.field, errs[k] && s.bad);

  return (
    <Modal wide>
      <h2>{id ? t('editTitle') : t('createTitle')}</h2>
      <form className={s.form} noValidate onSubmit={submit}>
        <div className={fieldCls('pn')}>
          <label htmlFor="pf-name">{t('name')}</label>
          <input
            id="pf-name"
            value={name}
            placeholder={t('namePh')}
            onChange={(e) => setName(e.target.value)}
          />
          <div className={s.err}>{errs.pn}</div>
        </div>
        <div className={s.field}>
          <span className={s.lbl}>{t('how')}</span>
          <div className={s.optg}>
            <label className={s.opt}>
              <input
                type="radio"
                name="how"
                checked={how === 'code'}
                onChange={() => setHow('code')}
              />
              {t('code')}
            </label>
            <label className={s.opt}>
              <input
                type="radio"
                name="how"
                checked={how === 'auto'}
                onChange={() => setHow('auto')}
              />
              {t('auto')}
            </label>
          </div>
        </div>
        {how === 'code' && (
          <div className={fieldCls('pc')}>
            <label htmlFor="pf-code">{t('codeLabel')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="pf-code"
                value={code}
                maxLength={16}
                style={{ textTransform: 'uppercase', fontFamily: 'var(--f-mono)' }}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                className={cx(s.btn, s.btnGhost)}
                onClick={() =>
                  setCode('NITA' + Math.random().toString(36).slice(2, 6).toUpperCase())
                }
              >
                {t('generate')}
              </button>
            </div>
            <div className={s.err}>{errs.pc}</div>
          </div>
        )}
        <div className={s.g2}>
          <div className={s.field}>
            <label htmlFor="pf-type">{t('type')}</label>
            <select
              id="pf-type"
              value={type}
              onChange={(e) => setType(e.target.value as Promotion['type'])}
            >
              <option value="PERCENT">{t('types.PERCENT')}</option>
              <option value="FIXED">{t('types.FIXED')}</option>
              <option value="FREE_SHIPPING">{t('types.FREE_SHIPPING')}</option>
            </select>
          </div>
          <div className={fieldCls('pv')}>
            <label htmlFor="pf-value">{t('value')}</label>
            <input
              id="pf-value"
              value={value}
              inputMode="decimal"
              disabled={type === 'FREE_SHIPPING'}
              onChange={(e) => setValue(e.target.value)}
            />
            <div className={s.err}>{errs.pv}</div>
          </div>
        </div>
        <div className={s.g2}>
          <div className={s.field}>
            <label htmlFor="pf-scope">{t('appliesTo')}</label>
            <select
              id="pf-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as Promotion['scope'])}
            >
              <option value="ALL">{t('scopes.ALL')}</option>
              <option value="CATEGORY">{t('scopes.CATEGORY')}</option>
              <option value="PRODUCTS">{t('scopes.PRODUCTS')}</option>
            </select>
          </div>
          <div className={s.field}>
            <label htmlFor="pf-min">{t('minSpend')}</label>
            <input
              id="pf-min"
              value={min}
              inputMode="decimal"
              placeholder={t('none')}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
        </div>
        {scope !== 'ALL' && (
          <div className={fieldCls('tg')}>
            <span className={s.lbl}>{t('choose')}</span>
            <div className={s.optg}>
              {(scope === 'CATEGORY'
                ? db.collections.map((c) => ({ id: c, label: tcol(c) }))
                : products.map((p) => ({ id: p.id, label: p.title }))
              ).map((o) => (
                <label key={o.id} className={s.opt}>
                  <input
                    type="checkbox"
                    checked={targets.includes(o.id)}
                    onChange={(e) =>
                      setTargets((x) =>
                        e.target.checked ? [...x, o.id] : x.filter((y) => y !== o.id),
                      )
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <div className={s.err}>{errs.tg}</div>
          </div>
        )}
        <div className={s.g3}>
          <div className={s.field}>
            <label htmlFor="pf-start">{t('starts')}</label>
            <input
              id="pf-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className={fieldCls('p2')}>
            <label htmlFor="pf-end">{t('ends')}</label>
            <input id="pf-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            <div className={s.err}>{errs.p2}</div>
          </div>
          <div className={s.field}>
            <label htmlFor="pf-limit">{t('limit')}</label>
            <input
              id="pf-limit"
              value={limit}
              inputMode="numeric"
              placeholder={t('unlimited')}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
        </div>
        <div className={s.infobox}>
          {t.rich(r.code !== null ? 'previewCode' : 'previewAuto', {
            desc: describe({ ...r, targetIds: r.targetIds, minSpend: r.minSpend }),
            code: r.code || '…',
            from: f.fmtD(r.start),
            to: f.fmtD(r.end),
            b: (x) => <b>{x}</b>,
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            className={cx(s.btn, s.btnGhost)}
            onClick={() => useUi.getState().close()}
          >
            {tc('cancel')}
          </button>
          <button type="submit" className={cx(s.btn, s.btnPrimary)}>
            {id ? t('save') : t('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
