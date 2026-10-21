'use client';

import { useState } from 'react';

import { EmptyView } from '@/components/feedback';
import { api, isApiError } from '@/lib/api';
import type { Service } from '@/lib/domain';
import { cn as cx } from '@/lib/utils/cn';
import { photoBg } from '@/lib/utils/photo';

import {
  createService,
  deleteService,
  patchService,
  renameServiceCategory,
  serviceInput,
} from '@/features/provider-shared/api';

import { StaffAvatar } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field, Modal } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useSaveBusiness } from '@/features/provider-shared/hooks/useSaveBusiness';
import { useServiceCategories } from '@/features/provider-shared/hooks/useServiceCategories';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import { firstName } from '@/features/provider-shared/util/logic';
import { addDays, todayIso } from '@/features/provider-shared/util/time';

import c from './services.module.css';

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

/** Services by category (searchable, filterable) + retail products (prototype `P.services`). */
export function ServicesPage() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const from30 = addDays(today, -30);
  const update = useProviderStore((s) => s.update);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>('all');
  const cats = useServiceCategories();

  const remove = async (s: Service) => {
    const up = d.appointments.filter(
      (x) =>
        x.serviceId === s.id &&
        x.date >= today &&
        ['REQUESTED', 'BOOKED', 'CONFIRMED'].includes(x.status),
    ).length;
    if (up) {
      const ok = await ui.confirm({
        title: t('services.upTitle', { name: s.name, n: up }),
        body: t('services.upBody'),
        ok: t('services.upOk'),
      });
      if (ok && (await setOnline(s, false)))
        ui.showToast(t('services.toastHidden', { name: s.name }));
      return;
    }
    const ok = await ui.confirm({
      title: t('services.delTitle', { name: s.name }),
      body: t('services.delBody'),
      ok: t('services.delOk'),
      danger: true,
    });
    if (!ok) return;
    const i = d.services.findIndex((x) => x.id === s.id);
    try {
      await deleteService(d.business.id, s.id);
    } catch {
      ui.showToast(t('services.saveFailed'));
      return;
    }
    update((dd) => {
      dd.services = dd.services.filter((x) => x.id !== s.id);
    });
    ui.showToast(t('services.deleted'), {
      label: t('common.undo'),
      // Undo creates the service again (a new id) with the same details.
      fn: () =>
        void createService(d.business.id, serviceInput(s))
          .then((back) =>
            update((dd) => {
              dd.services.splice(i, 0, back);
            }),
          )
          .catch(() => ui.showToast(t('services.saveFailed'))),
    });
  };

  /** Optimistic online / hidden switch (`PATCH /api/catalog/services/{id}`). */
  const setOnline = async (s: Service, on: boolean) => {
    const flip = (v: boolean) =>
      update((dd) => {
        const x = dd.services.find((y) => y.id === s.id);
        if (x) x.bookableOnline = v;
      });
    flip(on);
    try {
      await patchService(d.business.id, s.id, { bookableOnline: on });
      return true;
    } catch {
      flip(!on);
      ui.showToast(t('services.saveFailed'));
      return false;
    }
  };

  /** Online booking on or off for a whole category (`POST /api/catalog/services/online`). */
  const setAllOnline = async (ids: string[], on: boolean) => {
    const before = new Map(d.services.map((x) => [x.id, x.bookableOnline]));
    useProviderStore.getState().update((dd) => {
      for (const x of dd.services) if (ids.includes(x.id)) x.bookableOnline = on;
    });
    try {
      const r = await api.post<{ done: number }>(
        '/catalog/services/online',
        { ids, online: on },
        { businessId: d.business.id },
      );
      ui.showToast(t(on ? 'services.allOnlineDone' : 'services.allHiddenDone', { n: r.done }));
    } catch {
      useProviderStore.getState().update((dd) => {
        for (const x of dd.services) if (before.has(x.id)) x.bookableOnline = before.get(x.id)!;
      });
      ui.showToast(t('services.saveFailed'));
    }
  };

  const q = query.trim().toLowerCase();
  const used = cats.filter((c) => d.services.some((s) => s.category === c));
  const shown = d.services.filter(
    (s) => (cat === 'all' || s.category === cat) && (!q || s.name.toLowerCase().includes(q)),
  );
  // Completed bookings in the last 30 days, and the most any service had (the bars' full width).
  const booked = new Map(
    d.services.map((s) => [
      s.id,
      d.appointments.filter(
        (a) => a.serviceId === s.id && a.date > from30 && a.status === 'COMPLETED',
      ).length,
    ]),
  );
  const most = Math.max(1, ...booked.values());

  return (
    <>
      <div className={k('ph-h')}>
        <div>
          <h1>{t('services.title')}</h1>
          <p className={k('muted')}>
            {t('services.sub', {
              n: d.services.filter((s) => s.bookableOnline).length,
              total: d.services.length,
            })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={k('btn btn-ghost')}
            onClick={() => ui.open({ t: 'svcCategories' })}
          >
            {t('services.manageCategories')}
          </button>
          <button
            type="button"
            className={k('btn btn-primary')}
            onClick={() => ui.open({ t: 'svcForm' })}
          >
            <PIcon name="plus" size={18} />
            {t('services.add')}
          </button>
        </div>
      </div>
      {!d.services.length && (
        <section className={k('panel')}>
          <EmptyView
            title={t('services.emptyTitle')}
            body={t('services.emptyBody')}
            action={
              <button
                type="button"
                className={k('btn btn-primary')}
                onClick={() => ui.open({ t: 'svcForm' })}
              >
                {t('services.add')}
              </button>
            }
          />
        </section>
      )}
      {d.services.length > 0 && (
        <div className={c.bar}>
          <label className={k('search')}>
            <PIcon name="search" size={18} />
            <input
              type="search"
              aria-label={t('services.searchPh')}
              placeholder={t('services.searchPh')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {used.length > 1 && (
            <div className={k('chips')} role="group" aria-label={t('services.category')}>
              {['all', ...used].map((x) => (
                <button
                  key={x}
                  type="button"
                  className={k('chip', cat === x && 'on')}
                  aria-pressed={cat === x}
                  onClick={() => setCat(x)}
                >
                  {x === 'all' ? t('services.all') : f.category(x)}
                  <span className={k('ct')}>
                    {x === 'all'
                      ? d.services.length
                      : d.services.filter((s) => s.category === x).length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {d.services.length > 0 && !shown.length && (
        <section className={k('panel')}>
          <EmptyView
            title={t('services.noMatch', { q: query.trim() })}
            body={t('services.noMatchBody')}
            action={
              <button
                type="button"
                className={k('btn')}
                onClick={() => {
                  setQuery('');
                  setCat('all');
                }}
              >
                {t('services.clear')}
              </button>
            }
          />
        </section>
      )}
      {cats.map((cg) => {
        const list = shown.filter((s) => s.category === cg);
        if (!list.length) return null;
        return (
          <section key={cg} className={k('panel')}>
            <div className={c.panelH}>
              <h2>
                <span className={c.catIc}>
                  <PIcon name="scissors" size={16} />
                </span>
                {f.category(cg)}
                <span className={c.count}>{list.length}</span>
              </h2>
              {list.length > 1 && (
                <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  {list.some((x) => !x.bookableOnline) && (
                    <button
                      type="button"
                      className={k('btn btn-ghost btn-sm')}
                      onClick={() =>
                        void setAllOnline(
                          list.map((x) => x.id),
                          true,
                        )
                      }
                    >
                      {t('services.allOnline')}
                    </button>
                  )}
                  {list.some((x) => x.bookableOnline) && (
                    <button
                      type="button"
                      className={k('btn btn-ghost btn-sm')}
                      onClick={() =>
                        void setAllOnline(
                          list.map((x) => x.id),
                          false,
                        )
                      }
                    >
                      {t('services.allHidden')}
                    </button>
                  )}
                </span>
              )}
              <button
                type="button"
                className={c.addIn}
                onClick={() => ui.open({ t: 'svcForm', cat: cg })}
              >
                <PIcon name="plus" size={16} />
                {t('services.addIn', { cat: f.category(cg) })}
              </button>
            </div>
            <div className={k('tbl-wrap')}>
              <table className={c.table}>
                <colgroup>
                  <col />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 210 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 84 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{t('services.thService')}</th>
                    <th>{t('services.thDuration')}</th>
                    <th className={k('r')}>{t('services.thPrice')}</th>
                    <th>{t('services.thDoneBy')}</th>
                    <th className={k('r')}>{t('services.thBooked')}</th>
                    <th>{t('services.thOnline')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const team = s.staffIds.flatMap((id) => d.staff.find((m) => m.id === id) ?? []);
                    const n = booked.get(s.id) ?? 0;
                    return (
                      <tr key={s.id} className={cx(c.row, !s.bookableOnline && c.off)}>
                        <td className={cx(c.cName, c.name)}>
                          <strong>{s.name}</strong>
                          {!s.bookableOnline && (
                            <span className={c.sub}>{t('services.hiddenSub')}</span>
                          )}
                        </td>
                        <td className={c.cDur}>
                          <span className={c.dur}>{f.dur(s.durationMin)}</span>
                        </td>
                        <td className={cx(c.cPrice, k('r'))}>
                          <span className={c.price}>{f.money(s.price)}</span>
                          {s.discountPct ? (
                            <span className={c.deal}>
                              {t('services.dealPct', { n: s.discountPct })}
                            </span>
                          ) : null}
                        </td>
                        <td className={c.cTeam}>
                          {team.length ? (
                            <span className={c.team}>
                              <span className={c.avs}>
                                {team.slice(0, 3).map((m) => (
                                  <span key={m.id} title={m.name}>
                                    <StaffAvatar m={m} size={26} />
                                  </span>
                                ))}
                              </span>
                              <span className={c.names}>
                                {team.length > 2
                                  ? t('services.namesMore', {
                                      name: firstName(team[0]!.name),
                                      n: team.length - 1,
                                    })
                                  : team.map((m) => firstName(m.name)).join(', ')}
                              </span>
                            </span>
                          ) : (
                            <span className={c.nobody}>
                              <PIcon name="alert" size={14} />
                              {t('services.noStaff')}
                            </span>
                          )}
                        </td>
                        <td className={cx(c.cBooked, k('r'))}>
                          <span className={c.booked}>
                            <b>{n}</b>
                            <span className={c.meter} aria-hidden>
                              <i style={{ width: `${(n / most) * 100}%` }} />
                            </span>
                          </span>
                        </td>
                        <td className={c.cOnline}>
                          <span className={c.online}>
                            <label className={k('sw')}>
                              <input
                                type="checkbox"
                                checked={s.bookableOnline}
                                aria-label={t('services.onlineLabel', { name: s.name })}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  void setOnline(s, on).then(
                                    (ok) =>
                                      ok &&
                                      ui.showToast(
                                        on
                                          ? t('services.toastOnline', { name: s.name })
                                          : t('services.toastHidden', { name: s.name }),
                                      ),
                                  );
                                }}
                              />
                              <span />
                            </label>
                            {s.bookableOnline ? t('services.isOnline') : t('services.isHidden')}
                          </span>
                        </td>
                        <td className={c.cActs}>
                          <span className={c.acts}>
                            <button
                              type="button"
                              className={c.act}
                              aria-label={t('services.edit', { name: s.name })}
                              title={t('services.edit', { name: s.name })}
                              onClick={() => ui.open({ t: 'svcForm', id: s.id })}
                            >
                              <PIcon name="edit" size={17} />
                            </button>
                            <button
                              type="button"
                              className={cx(c.act, c.danger)}
                              aria-label={t('services.delete', { name: s.name })}
                              title={t('services.delete', { name: s.name })}
                              onClick={() => void remove(s)}
                            >
                              <PIcon name="trash" size={17} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <section className={k('panel')}>
        <div className={c.panelH}>
          <h2>
            {t('services.retail')}
            {d.products.length > 0 && <span className={c.count}>{d.products.length}</span>}
          </h2>
          <span className={k('tiny muted')}>{t('services.retailSub')}</span>
        </div>
        {d.products.length ? (
          <div className={c.shelf}>
            {d.products.map((p) => {
              const stock = p.variants.reduce((n, v) => n + v.stock, 0);
              return (
                <div key={p.id} className={c.item}>
                  <span className={c.thumb} style={photoBg(p.photos[0])}>
                    {p.photos[0] ? null : <PIcon name="receipt" size={18} />}
                  </span>
                  <span className={c.itemText}>
                    <strong>{p.title}</strong>
                    <span>
                      {f.money(p.variants[0]?.price ?? 0)} ·{' '}
                      {stock > 0 ? t('services.inStock', { n: stock }) : t('services.outStock')}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyView title={t('services.noRetail')} body={t('services.noRetailBody')} />
        )}
      </section>
    </>
  );
}

/** Add / edit service (prototype `svcForm`). */
export function ServiceForm({ id, cat: preset }: { id?: string; cat?: string }) {
  const { t, category } = useFmt();
  const d = useData();
  const cats = useServiceCategories();
  const ui = useUi();
  const s = id ? d.services.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(s?.name ?? '');
  const [desc, setDesc] = useState(s?.description ?? '');
  const [cat, setCat] = useState(s?.category ?? preset ?? cats[0] ?? 'Services');
  const [dur, setDur] = useState(s?.durationMin ?? 45);
  const [price, setPrice] = useState(s ? String(s.price) : '');
  const [staff, setStaff] = useState<string[]>(s?.staffIds ?? []);
  const [online, setOnline] = useState(s?.bookableOnline ?? true);
  const [err, setErr] = useState<{ sn?: string; sp?: string; ss?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    const p = parseFloat(price);
    const e = {
      sn:
        n.length < 2
          ? t('services.errName')
          : d.services.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())
            ? t('services.errDup')
            : '',
      sp: p > 0 ? '' : t('services.errPrice'),
      ss: staff.length ? '' : t('services.errStaff'),
    };
    setErr(e);
    if (e.sn || e.sp || e.ss) return;
    const data = {
      name: n,
      category: cat,
      description: desc.trim(),
      durationMin: dur,
      price: +p.toFixed(2),
      staffIds: staff,
      bookableOnline: online,
    };
    if (busy) return;
    setBusy(true);
    let saved: Service;
    try {
      saved = id
        ? await patchService(d.business.id, id, data)
        : await createService(d.business.id, data);
    } catch (e) {
      if (isApiError(e, 'CONFLICT')) setErr({ sn: t('services.errDup') });
      else ui.showToast(t('services.saveFailed'));
      return;
    } finally {
      setBusy(false);
    }
    useProviderStore.getState().update((dd) => {
      const i = dd.services.findIndex((x) => x.id === saved.id);
      if (i >= 0) dd.services[i] = saved;
      else dd.services.push(saved);
    });
    ui.close(true);
    ui.showToast(id ? t('services.saved') : t('services.added', { name: n }));
  };

  return (
    <Modal>
      <h2>{id ? t('services.titleEdit') : t('services.titleAdd')}</h2>
      <form
        className={k('form')}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id="sn" label={t('services.name')} error={err.sn ?? ''}>
          <input
            id="sn"
            maxLength={40}
            placeholder={t('services.namePh')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id="sdesc" label={t('services.description')}>
          <textarea
            id="sdesc"
            maxLength={500}
            placeholder={t('services.descriptionPh')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Field>
        <div className={k('g3')}>
          <Field id="sc" label={t('services.category')}>
            <select id="sc" value={cat} onChange={(e) => setCat(e.target.value)}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {category(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sd" label={t('services.duration')}>
            <select id="sd" value={dur} onChange={(e) => setDur(Number(e.target.value))}>
              {DURATIONS.map((x) => (
                <option key={x} value={x}>
                  {t('time.min', { n: x })}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sp" label={t('services.price')} error={err.sp ?? ''}>
            <div className={k('prefix')}>
              <span>$</span>
              <input
                id="sp"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </Field>
        </div>
        <Field label={t('services.who')} error={err.ss ?? ''}>
          <div className={k('optg')}>
            {d.staff.map((m) => (
              <label key={m.id} className={k('opt')}>
                <input
                  type="checkbox"
                  checked={staff.includes(m.id)}
                  onChange={(e) =>
                    setStaff((xs) =>
                      e.target.checked ? [...xs, m.id] : xs.filter((x) => x !== m.id),
                    )
                  }
                />
                <StaffAvatar m={m} size={22} />
                {firstName(m.name)}
              </label>
            ))}
          </div>
        </Field>
        <label className={k('swr')}>
          <span>
            <strong>{t('services.online')}</strong>
            <span className={k('hint')}>{t('services.onlineHint')}</span>
          </span>
          <span className={k('sw')}>
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
            <span />
          </span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className={k('btn btn-ghost')} onClick={() => ui.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={k('btn btn-primary')} disabled={busy} aria-busy={busy}>
            {id ? t('services.submitEdit') : t('services.submitAdd')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The shop's service categories: add, rename (services follow), reorder, remove unused ones. */
export function ServiceCategories() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const save = useSaveBusiness();
  const cats = useServiceCategories();
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const used = (c: string) => d.services.filter((s) => s.category === c).length;
  const saveList = async (next: string[], done?: string) => {
    setBusy(true);
    const ok = await save({ serviceCategories: next });
    setBusy(false);
    if (ok && done) ui.showToast(done);
    return ok;
  };
  const rename = async (from: string) => {
    const to = (edit[from] ?? from).trim();
    if (to === from) return;
    if (to.length < 1 || to.length > 40) return setErr(t('services.catErrName'));
    setBusy(true);
    try {
      const list = await renameServiceCategory(d.business.id, from, to);
      useProviderStore.getState().update((dd) => {
        dd.business.serviceCategories = list;
        dd.services.forEach((s) => {
          if (s.category === from) s.category = to;
        });
      });
      setEdit((x) => {
        const { [from]: _, ...rest } = x;
        return rest;
      });
      ui.showToast(t('services.catRenamed', { name: to }));
    } catch {
      setErr(t('services.saveFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal label={t('services.catTitle')}>
      <h2>{t('services.catTitle')}</h2>
      <p className={k('muted small')} style={{ marginTop: -6 }}>
        {t('services.catSub')}
      </p>
      <ul className={c.catList}>
        {cats.map((cat, i) => (
          <li key={cat} className={c.catRow}>
            <input
              aria-label={t('services.catNameOf', { name: cat })}
              value={edit[cat] ?? cat}
              maxLength={40}
              onChange={(e) => {
                setEdit((x) => ({ ...x, [cat]: e.target.value }));
                setErr('');
              }}
              onBlur={() => void rename(cat)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <span className={k('muted small')}>{t('services.catCount', { n: used(cat) })}</span>
            <span className={c.acts}>
              <button
                type="button"
                className={c.act}
                aria-label={t('services.catUp', { name: cat })}
                disabled={busy || i === 0}
                onClick={() => {
                  const next = [...cats];
                  [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                  void saveList(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className={c.act}
                aria-label={t('services.catDown', { name: cat })}
                disabled={busy || i === cats.length - 1}
                onClick={() => {
                  const next = [...cats];
                  [next[i + 1], next[i]] = [next[i]!, next[i + 1]!];
                  void saveList(next);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className={cx(c.act, c.danger)}
                aria-label={t('services.catRemove', { name: cat })}
                title={used(cat) ? t('services.catInUse') : undefined}
                disabled={busy || used(cat) > 0}
                onClick={() =>
                  void saveList(
                    cats.filter((x) => x !== cat),
                    t('services.catRemoved', { name: cat }),
                  )
                }
              >
                <PIcon name="trash" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className={c.catAdd}
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (n.length < 1 || n.length > 40) return setErr(t('services.catErrName'));
          if (cats.some((x) => x.toLowerCase() === n.toLowerCase()))
            return setErr(t('services.catErrTaken'));
          void saveList([...cats, n], t('services.catAdded', { name: n })).then(
            (ok) => ok && setName(''),
          );
        }}
      >
        <input
          aria-label={t('services.catNew')}
          placeholder={t('services.catNew')}
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            setErr('');
          }}
        />
        <button type="submit" className={k('btn btn-primary btn-sm')} disabled={busy}>
          {t('services.catAdd')}
        </button>
      </form>
      {err && (
        <p className={k('err')} role="alert">
          {err}
        </p>
      )}
    </Modal>
  );
}
