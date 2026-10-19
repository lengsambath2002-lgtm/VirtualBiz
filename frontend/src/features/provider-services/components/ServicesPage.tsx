'use client';

import { useState } from 'react';

import { EmptyRow, EmptyView } from '@/components/feedback';
import { isApiError } from '@/lib/api';
import type { Service } from '@/lib/domain';

import {
  createService,
  deleteService,
  patchService,
  serviceInput,
} from '@/features/provider-shared/api';

import { StaffAvatar } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field, Modal } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import { SERVICE_CATEGORIES } from '@/features/provider-shared/types';
import { firstName } from '@/features/provider-shared/util/logic';
import { addDays, todayIso } from '@/features/provider-shared/util/time';

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

/** Services by category + retail products (prototype `P.services`). */
export function ServicesPage() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const from30 = addDays(today, -30);
  const update = useProviderStore((s) => s.update);

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
        <button
          type="button"
          className={k('btn btn-primary')}
          onClick={() => ui.open({ t: 'svcForm' })}
        >
          <PIcon name="plus" size={18} />
          {t('services.add')}
        </button>
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
      {SERVICE_CATEGORIES.map((cat) => {
        const list = d.services.filter((s) => s.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className={k('panel')}>
            <div className={k('panel-h')}>
              <h2>
                {f.category(cat)}{' '}
                <span className={k('muted num')} style={{ fontWeight: 400 }}>
                  {list.length}
                </span>
              </h2>
            </div>
            <div className={k('tbl-wrap')}>
              <table>
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
                  {list.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong style={{ fontWeight: 500 }}>{s.name}</strong>
                      </td>
                      <td className={k('num')}>{f.dur(s.durationMin)}</td>
                      <td className={k('r num')}>{f.money(s.price)}</td>
                      <td>
                        <span className={k('stack')}>
                          {s.staffIds.map((sid) => {
                            const m = d.staff.find((x) => x.id === sid);
                            return m ? (
                              <span key={sid} title={m.name}>
                                <StaffAvatar m={m} size={26} />
                              </span>
                            ) : null;
                          })}
                        </span>
                      </td>
                      <td className={k('r num')}>
                        {
                          d.appointments.filter(
                            (a) =>
                              a.serviceId === s.id && a.date > from30 && a.status === 'COMPLETED',
                          ).length
                        }
                      </td>
                      <td>
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
                      </td>
                      <td className={k('r')} style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className={k('ibtn')}
                          aria-label={t('services.edit', { name: s.name })}
                          onClick={() => ui.open({ t: 'svcForm', id: s.id })}
                        >
                          <PIcon name="edit" size={18} />
                        </button>
                        <button
                          type="button"
                          className={k('ibtn')}
                          style={{ color: 'var(--danger)' }}
                          aria-label={t('services.delete', { name: s.name })}
                          onClick={() => void remove(s)}
                        >
                          <PIcon name="trash" size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <section className={k('panel')}>
        <div className={k('panel-h')}>
          <h2>{t('services.retail')}</h2>
          <span className={k('tiny muted')}>{t('services.retailSub')}</span>
        </div>
        <div className={k('tbl-wrap')}>
          <table style={{ minWidth: 420 }}>
            <tbody>
              {!d.products.length && (
                <EmptyRow
                  cols={2}
                  title={t('services.noRetail')}
                  body={t('services.noRetailBody')}
                />
              )}
              {d.products.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td className={k('r num')}>{f.money(p.variants[0]?.price ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/** Add / edit service (prototype `svcForm`). */
export function ServiceForm({ id }: { id?: string }) {
  const { t, category } = useFmt();
  const d = useData();
  const ui = useUi();
  const s = id ? d.services.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(s?.name ?? '');
  const [cat, setCat] = useState(s?.category ?? 'Hair');
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
        <div className={k('g3')}>
          <Field id="sc" label={t('services.category')}>
            <select id="sc" value={cat} onChange={(e) => setCat(e.target.value)}>
              {SERVICE_CATEGORIES.map((c) => (
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
