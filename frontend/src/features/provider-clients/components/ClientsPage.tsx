'use client';

import { useEffect, useRef, useState } from 'react';

import { isApiError } from '@/lib/api';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

import { ClientAvatar, StatusPill } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { CloseButton, Drawer, Field, Modal } from '@/features/provider-shared/components/Overlay';
import { createClient, patchClient } from '@/features/provider-shared/api';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import {
  clientStats,
  firstName,
  segmenter,
  type ClientFilter,
} from '@/features/provider-shared/util/logic';
import {
  daysBetween,
  fmtDay2Month,
  fmtMonthYear,
  hm,
  isoOf,
  relKey,
  todayIso,
} from '@/features/provider-shared/util/time';

const FILTERS: ClientFilter[] = ['all', 'vip', 'new', 'risk', 'noshow'];
const TAG_TONE = { vip: 'warn', new: 'info', risk: 'bad' } as const;

/** Clients with segments (prototype `P.clients`). */
export function ClientsPage() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const [q, setQ] = useState(ui.clientQ);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const rows = d.clients.map((c) => ({ c, st: clientStats(d, c.id) }));
  const { tag, filters } = segmenter(rows, today);
  const query = ui.clientQ.trim().toLowerCase().replace(/\s/g, '');
  const list = rows
    .filter(filters[ui.clientF])
    .filter(
      (r) =>
        !query ||
        (r.c.name + r.c.phone + (r.c.email ?? '')).toLowerCase().replace(/\s/g, '').includes(query),
    )
    .sort((a, b) => (b.st.last ?? '').localeCompare(a.st.last ?? ''));

  const lastLabel = (iso: string) => {
    const rk = relKey(iso, today);
    return rk ? t(`time.${rk}`) : t('clients.daysAgo', { n: daysBetween(iso, today) });
  };

  return (
    <>
      <div className={k('ph-h')}>
        <div>
          <h1>{t('clients.title')}</h1>
          <p className={k('muted')}>{t('clients.sub', { n: d.clients.length })}</p>
        </div>
        <button
          type="button"
          className={k('btn btn-primary')}
          onClick={() => ui.open({ t: 'newClient' })}
        >
          <PIcon name="plus" size={18} />
          {t('clients.add')}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className={k('search')}>
          <PIcon name="search" size={18} />
          <input
            type="search"
            value={q}
            placeholder={t('clients.searchPh')}
            aria-label={t('clients.searchLabel')}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => ui.set({ clientQ: v }), 200);
            }}
          />
        </div>
        <div className={k('chips')}>
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              className={k('chip', ui.clientF === key && 'on')}
              onClick={() => ui.set({ clientF: key })}
            >
              {t(`clients.f.${key}`)}{' '}
              <span className={k('ct num')}>{rows.filter(filters[key]).length}</span>
            </button>
          ))}
        </div>
      </div>
      <section className={k('panel')}>
        <div className={k('tbl-wrap')}>
          <table>
            <thead>
              <tr>
                <th>{t('clients.thClient')}</th>
                <th>{t('clients.thPhone')}</th>
                <th className={k('r')}>{t('clients.thVisits')}</th>
                <th className={k('r')}>{t('clients.thSpent')}</th>
                <th>{t('clients.thLast')}</th>
                <th>{t('clients.thNext')}</th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((r) => {
                  const tg = tag(r);
                  const openIt = () => ui.open({ t: 'client', id: r.c.id });
                  return (
                    <tr
                      key={r.c.id}
                      className={k('clk')}
                      tabIndex={0}
                      onClick={openIt}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openIt();
                      }}
                    >
                      <td>
                        <div className={k('cw')}>
                          <ClientAvatar c={r.c} size={32} />
                          <div>
                            <div className={k('who')}>
                              {r.c.name}{' '}
                              {tg && (
                                <span className={k('pill', TAG_TONE[tg])} style={{ fontSize: 11 }}>
                                  {t(`clients.tag.${tg}`)}
                                </span>
                              )}
                            </div>
                            {r.st.noshow > 0 && (
                              <span className={k('tiny')} style={{ color: 'var(--danger)' }}>
                                {t('clients.noShowN', { n: r.st.noshow })}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={k('num')}>{formatPhone(r.c.phone)}</td>
                      <td className={k('r num')}>{r.st.visits}</td>
                      <td className={k('r num')}>{f.money0(r.st.spend)}</td>
                      <td>
                        {r.st.last ? lastLabel(r.st.last) : <span className={k('muted')}>–</span>}
                      </td>
                      <td>
                        {r.st.next ? (
                          <span className={k('num')}>
                            {f.rel(r.st.next.date, today)} {hm(r.st.next.start)}
                          </span>
                        ) : (
                          <span className={k('muted')}>{t('clients.none')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className={k('empty')}>
                      <strong>{t('clients.empty')}</strong>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/** Client drawer with the auto-saving note (prototype `openClient`). */
export function ClientDrawer({ id }: { id: string }) {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const act = useActions();
  const c = d.clients.find((x) => x.id === id);
  const [note, setNote] = useState(c?.note ?? '');
  const [noteState, setNoteState] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!c) return null;
  const st = clientStats(d, id);
  const hist = d.appointments
    .filter((a) => a.clientId === id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
  return (
    <Drawer label={c.name}>
      <div className={k('dr-h')}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ClientAvatar c={c} size={48} />
          <div>
            <h2>{c.name}</h2>
            <div className={k('meta num')}>
              {formatPhone(c.phone)}
              {c.email ? ` · ${c.email}` : ''}
            </div>
          </div>
        </div>
        <CloseButton />
      </div>
      <div className={k('dr-b')}>
        <div className={k('g3')} style={{ textAlign: 'center' }}>
          {(
            [
              [t('clients.visits'), st.visits],
              [t('clients.spent'), f.money0(st.spend)],
              [t('clients.noShows'), st.noshow],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className={k('card')} style={{ padding: 10, gap: 0 }}>
              <b className={k('num')} style={{ fontSize: 18 }}>
                {v}
              </b>
              <span className={k('tiny muted')}>{l}</span>
            </div>
          ))}
        </div>
        <div className={k('field')}>
          <label htmlFor="cnote">
            {t('clients.note')}{' '}
            <span className={k('muted')} style={{ fontWeight: 400 }}>
              {t('clients.noteHint')}
            </span>
          </label>
          <textarea
            id="cnote"
            rows={2}
            maxLength={200}
            placeholder={t('clients.notePh')}
            value={note}
            onChange={(e) => {
              const v = e.target.value;
              setNote(v);
              clearTimeout(timer.current);
              setNoteState(t('clients.saving'));
              timer.current = setTimeout(() => {
                const bid = useProviderStore.getState().data!.business.id;
                patchClient(bid, id, { note: v.trim() }).then(
                  (c) => {
                    useProviderStore.getState().update((dd) => {
                      const i = dd.clients.findIndex((y) => y.id === id);
                      if (i >= 0) dd.clients[i] = c;
                    });
                    setNoteState(t('clients.saved'));
                  },
                  () => setNoteState(t('common.failed')),
                );
              }, 500);
            }}
          />
          <span className={k('hint')}>{noteState}</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className={k('sec-t')}>{t('clients.history')}</div>
          {hist.length ? (
            hist.slice(0, 12).map((a) => (
              <button
                key={a.id}
                type="button"
                className={k('row')}
                style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}
                onClick={() => act.openAppt(a.id)}
              >
                <span className={k('t num')} style={{ minWidth: 'auto' }}>
                  {fmtDay2Month(a.date, locale)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block' }}>
                    {d.services.find((s) => s.id === a.serviceId)?.name}
                  </span>
                  <span className={k('tiny muted')}>
                    {firstName(d.staff.find((m) => m.id === a.staffId)?.name ?? '')} · {hm(a.start)}
                  </span>
                </span>
                <StatusPill status={a.status} />
              </button>
            ))
          ) : (
            <p className={k('muted small')}>{t('clients.noVisits')}</p>
          )}
        </div>
        <p className={k('tiny muted')}>
          {t('clients.since', { date: fmtMonthYear(isoOf(Date.parse(c.since)), locale) })}
        </p>
      </div>
      <div className={k('dr-f')}>
        <div className={k('r')}>
          <button
            type="button"
            className={k('btn btn-ghost')}
            onClick={() => void act.copy(formatPhone(c.phone))}
          >
            <PIcon name="phone" size={18} />
            {t('clients.copyPhone')}
          </button>
          <button
            type="button"
            className={k('btn btn-primary')}
            onClick={() => ui.open({ t: 'apptForm', opts: { clientId: c.id } })}
          >
            <PIcon name="plus" size={18} />
            {t('clients.newAppt')}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

/** Add client (New ▸ Client, Clients ▸ Add client). */
export function NewClientForm() {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ nn?: string; np?: string }>({});
  const actions = useActions();
  const submit = async () => {
    const n = name.trim();
    const p = normalizePhone(phone);
    const e = {
      nn: n.length < 2 ? t('clients.errName') : '',
      np: !isValidPhone(phone)
        ? t('clients.errPhone')
        : d.clients.some((c) => c.phone === p)
          ? t('clients.errExists')
          : '',
    };
    setErr(e);
    if (e.nn || e.np) return;
    let id: string;
    try {
      const c = await createClient(d.business.id, {
        name: n,
        phone: p,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      id = c.id;
      useProviderStore.getState().update((dd) => {
        dd.clients.push(c);
      });
    } catch (err) {
      setErr(
        isApiError(err, 'DUPLICATE_CLIENT')
          ? { np: t('clients.errExists') }
          : isApiError(err, 'VALIDATION_FAILED')
            ? { nn: t('common.failed') }
            : {},
      );
      if (!isApiError(err, 'DUPLICATE_CLIENT', 'VALIDATION_FAILED')) actions.fail(err);
      return;
    }
    ui.close(true);
    ui.showToast(t('clients.added', { name: n }), {
      label: t('clients.book'),
      fn: () => ui.open({ t: 'apptForm', opts: { clientId: id } }),
    });
  };
  return (
    <Modal>
      <h2>{t('clients.newTitle')}</h2>
      <form
        className={k('form')}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id="nn" label={t('clients.name')} error={err.nn ?? ''}>
          <input id="nn" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className={k('g2')}>
          <Field id="npp" label={t('clients.phone')} error={err.np ?? ''}>
            <input
              id="npp"
              inputMode="tel"
              placeholder="012 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id="nem" label={t('clients.email')}>
            <input id="nem" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field id="nno" label={t('clients.noteField')}>
          <input
            id="nno"
            placeholder={t('clients.noteFieldPh')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <button type="submit" className={k('btn btn-primary')}>
          {t('clients.submit')}
        </button>
      </form>
    </Modal>
  );
}
