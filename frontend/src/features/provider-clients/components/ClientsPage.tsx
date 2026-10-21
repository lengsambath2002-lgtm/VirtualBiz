'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { isApiError } from '@/lib/api';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

import { ClientAvatar, StatusPill } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { CloseButton, Drawer, Field, Modal } from '@/features/provider-shared/components/Overlay';

import { useMyRole } from '@/features/account-switcher';
import { CustomerList, EditCustomerDialog } from '@/features/business-customers';
import { providerWorkspaceKey } from '@/features/provider-shared/queries';
import { createClient, patchClient, toClient } from '@/features/provider-shared/api';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import { clientStats, firstName } from '@/features/provider-shared/util/logic';
import { fmtDay2Month, fmtMonthYear, hm, isoOf } from '@/features/provider-shared/util/time';

/**
 * Clients (docs/api/phase16-shop-lists.md): every client a page at a time from the API, with
 * lifetime visits and spend and the prototype's segments worked out on the server.
 */
export function ClientsPage() {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const qc = useQueryClient();
  const role = useMyRole(d.business.id);
  return (
    <CustomerList
      businessId={d.business.id}
      type="SERVICE"
      canManage={role === 'OWNER' || role === 'MANAGER'}
      title={t('clients.title')}
      sub={(n) => t('clients.sub', { n })}
      onOpen={(r) => ui.open({ t: 'client', id: r.id })}
      onSaved={() => void qc.invalidateQueries({ queryKey: providerWorkspaceKey(d.business.id) })}
    />
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
  const [editing, setEditing] = useState(false);
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
              {c.district ? ` · ${c.district}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className={k('btn btn-ghost btn-sm')}
            onClick={() => setEditing(true)}
          >
            {t('clients.edit')}
          </button>
          <CloseButton />
        </div>
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
      {editing && (
        <EditCustomerDialog
          businessId={d.business.id}
          customer={{ ...c, clientId: c.id }}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            clearTimeout(timer.current);
            setNote(saved.note ?? '');
            setNoteState('');
            useProviderStore.getState().update((dd) => {
              const i = dd.clients.findIndex((y) => y.id === saved.id);
              if (i >= 0) dd.clients[i] = toClient(saved);
            });
            act.toast(t('clients.saved'));
          }}
        />
      )}
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
