'use client';

import { useEffect, useRef, useState } from 'react';

import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

import { ClientAvatar } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field, Modal } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { calendarHref, failMessage } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { createAppointment, patchAppointment } from '@/features/provider-shared/api';
import {
  putAppointment,
  useData,
  useProviderStore,
  useUi,
  type ApptFormOpts,
} from '@/features/provider-shared/store';
import { SERVICE_CATEGORIES, type ProviderAppointment } from '@/features/provider-shared/types';
import { conflicts, firstName, pickStaff } from '@/features/provider-shared/util/logic';
import {
  fmtD,
  H0,
  H1,
  hm,
  isIsoDate,
  nowMin,
  todayIso,
} from '@/features/provider-shared/util/time';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { useSearchParams } from 'next/navigation';

const STARTS = Array.from({ length: (H1 - H0) * 4 }, (_, i) => H0 * 60 + i * 15);

/** New / edit / walk-in appointment (prototype `apptForm`). */
export function ApptForm({ opts }: { opts: ApptFormOpts }) {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const a = opts.id ? d.appointments.find((x) => x.id === opts.id) : undefined;
  const calDate = isIsoDate(search.get('date')) ? search.get('date')! : todayIso();
  const dr = opts.draft;

  const initStart = () => {
    if (opts.walkin) return Math.round(nowMin() / 15) * 15;
    const m = a ? a.start : (opts.start ?? Math.max(9 * 60, Math.ceil((nowMin() + 15) / 15) * 15));
    return STARTS.includes(m) ? m : STARTS[0]!;
  };
  const [clientText, setClientText] = useState(
    dr?.clientText ?? (a ? nameOf(a.clientId) : opts.clientId ? nameOf(opts.clientId) : ''),
  );
  const [cId, setCId] = useState(dr?.clientId ?? (a ? a.clientId : (opts.clientId ?? '')));
  const [phone, setPhone] = useState(dr?.phone ?? '');
  const [sId, setSId] = useState(dr?.serviceId ?? (a ? a.serviceId : (opts.serviceId ?? '')));
  const [stId, setStId] = useState(dr?.staffId ?? (a ? a.staffId : (opts.staffId ?? '')));
  const [date, setDate] = useState(
    dr?.date ??
      (opts.walkin
        ? todayIso()
        : a
          ? a.date
          : (opts.date ?? (pathname === '/provider/calendar' ? calDate : todayIso()))),
  );
  const [start, setStart] = useState(dr?.start ?? initStart());
  const [note, setNote] = useState(dr?.note ?? a?.note ?? '');
  const [combo, setCombo] = useState(false);
  // The prototype wires the combo after the dialog has focused the field, so the list only
  // opens on a later focus or typing. The modal's autofocus runs before this effect.
  const armed = useRef(false);
  useEffect(() => {
    armed.current = true;
  }, []);
  const [err, setErr] = useState<{ cl?: string; np?: string; sv?: string }>({});

  function nameOf(id: string) {
    return d.clients.find((c) => c.id === id)?.name ?? '';
  }

  const svc = d.services.find((s) => s.id === sId);
  const staffList = svc ? d.staff.filter((m) => svc.staffIds.includes(m.id)) : d.staff;
  const stValue = staffList.some((m) => m.id === stId) ? stId : '';
  const who = () => stValue || (svc ? pickStaff(d, svc.id, { date, start }, a?.id) : '');
  const clash = () => {
    if (!svc || !date) return null;
    const w = who();
    return {
      w,
      list: conflicts(d, { staffId: w, date, start, durationMin: svc.durationMin }, a?.id),
    };
  };
  const ck = clash();

  const q = clientText.trim().toLowerCase();
  const matches = d.clients
    .filter((c) => !q || (c.name + c.phone).toLowerCase().includes(q.replace(/\s/g, '')))
    .slice(0, 6);
  const showNew = q && !matches.some((c) => c.name.toLowerCase() === q);
  const comboOpen = combo && !a && (matches.length > 0 || !!showNew);

  const submit = async () => {
    const nm = clientText.trim();
    const e: typeof err = {
      cl: !cId ? (nm ? t('form.errPick') : t('form.errChoose')) : '',
      np: cId === 'new' && !isValidPhone(phone) ? t('form.errPhone') : '',
      sv: sId ? '' : t('form.errService'),
    };
    setErr(e);
    if (e.cl || e.np || e.sv || !svc) return;
    const c = clash();
    if (c && c.list.length) {
      const ok = await ui.confirm({
        title: t('form.dblTitle'),
        body: t('form.dblBody', { list: f.conflicts(c.list) }),
        ok: t('form.dblOk'),
      });
      if (!ok) {
        ui.open({
          t: 'apptForm',
          opts: {
            ...opts,
            draft: {
              clientText,
              clientId: cId,
              phone,
              serviceId: sId,
              staffId: stValue,
              date,
              start,
              note,
            },
          },
        });
        return;
      }
    }
    const w = who();
    const bid = d.business.id;
    if (a) {
      try {
        putAppointment(
          await patchAppointment(bid, a.id, {
            serviceId: svc.id,
            staffId: w,
            date,
            start,
            note: note.trim(),
          }),
        );
      } catch (e) {
        ui.showToast(failMessage(t, e));
        return;
      }
      ui.close(true);
      ui.showToast(t('form.toastUpdated'));
      return;
    }
    let created: ProviderAppointment;
    try {
      created = await createAppointment(bid, {
        ...(cId === 'new'
          ? { client: { name: nm, phone: normalizePhone(phone) } }
          : { clientId: cId }),
        serviceId: svc.id,
        staffId: w,
        date,
        start,
        source: opts.walkin ? 'WALK_IN' : 'PHONE',
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (e) {
      ui.showToast(failMessage(t, e));
      return;
    }
    putAppointment(created);
    if (!d.clients.some((c) => c.id === created.clientId)) {
      useProviderStore.getState().update((dd) => {
        dd.clients.push({
          id: created.clientId,
          businessId: bid,
          name: nm,
          phone: normalizePhone(phone),
          since: new Date().toISOString(),
          tags: [],
        });
      });
    }
    const clientName =
      useProviderStore.getState().data?.clients.find((c) => c.id === created.clientId)?.name ?? nm;
    ui.close(true);
    if (pathname === '/provider/calendar') {
      router.push(
        calendarHref({
          date,
          view: (search.get('view') as 'week') ?? 'day',
          staff: search.get('staff') ?? 'all',
        }),
      );
    } else router.push(calendarHref({ date }));
    const staffName = firstName(d.staff.find((m) => m.id === w)?.name ?? '');
    ui.showToast(
      opts.walkin
        ? t('form.toastWalkin', { name: clientName, staff: staffName })
        : t('form.toastBooked', { name: clientName, date: fmtD(date, locale), time: hm(start) }),
      { label: t('common.open'), fn: () => ui.open({ t: 'appt', id: created.id }) },
    );
  };

  return (
    <Modal>
      <h2>{a ? t('form.titleEdit') : opts.walkin ? t('form.titleWalkin') : t('form.titleNew')}</h2>
      <form
        className={k('form')}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id="cq" label={t('form.client')} error={err.cl ?? ''}>
          <input
            id="cq"
            autoComplete="off"
            placeholder={t('form.clientPh')}
            value={clientText}
            readOnly={!!a}
            onFocus={() => armed.current && setCombo(true)}
            onBlur={() => setTimeout(() => setCombo(false), 120)}
            onChange={(e) => {
              setClientText(e.target.value);
              setCId('');
              setCombo(true);
            }}
          />
          {comboOpen && (
            <div className={k('combo')}>
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCId(c.id);
                    setClientText(c.name);
                    setCombo(false);
                    setErr((x) => ({ ...x, cl: '' }));
                  }}
                >
                  <ClientAvatar c={c} size={28} />
                  <span>
                    <span style={{ display: 'block' }}>{c.name}</span>
                    <span className={k('tiny muted num')}>{formatPhone(c.phone)}</span>
                  </span>
                </button>
              ))}
              {showNew && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCId('new');
                    setCombo(false);
                    setErr((x) => ({ ...x, cl: '' }));
                    setTimeout(() => document.getElementById('np')?.focus(), 0);
                  }}
                >
                  <PIcon name="plus" size={16} />
                  {t('form.addNew', { name: clientText.trim() })}
                </button>
              )}
            </div>
          )}
        </Field>
        <Field id="np" label={t('form.newPhone')} error={err.np ?? ''} hidden={cId !== 'new'}>
          <input
            id="np"
            inputMode="tel"
            placeholder={t('form.phonePh')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <div className={k('g2')}>
          <Field id="sv" label={t('form.service')} error={err.sv ?? ''}>
            <select
              id="sv"
              value={sId}
              onChange={(e) => {
                setSId(e.target.value);
                setErr((x) => ({ ...x, sv: '' }));
              }}
            >
              <option value="">{t('form.choose')}</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={f.category(cat)}>
                  {d.services
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {t('form.serviceOpt', {
                          name: s.name,
                          dur: s.durationMin,
                          price: f.money0(s.price),
                        })}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field id="st" label={t('form.staff')}>
            <select id="st" value={stValue} onChange={(e) => setStId(e.target.value)}>
              <option value="">{t('form.firstAvailable')}</option>
              {staffList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={k('g2')}>
          <Field id="dt" label={t('form.date')}>
            <input type="date" id="dt" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="tm" label={t('form.start')}>
            <select id="tm" value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {STARTS.map((m) => (
                <option key={m} value={m}>
                  {hm(m)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="nt" label={t('form.note')}>
          <textarea
            id="nt"
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <div>
          {ck &&
            (ck.list.length ? (
              <div className={k('warnbox')}>
                <PIcon name="alert" size={14} /> {t('form.clash', { list: f.conflicts(ck.list) })}
              </div>
            ) : (
              <div className={k('okbox')}>
                <PIcon name="check" size={14} />{' '}
                {t('form.free', {
                  name: d.staff.find((m) => m.id === ck.w)?.name ?? '',
                  from: hm(start),
                  to: hm(start + (svc?.durationMin ?? 0)),
                })}
              </div>
            ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className={k('btn btn-ghost')} onClick={() => ui.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={k('btn btn-primary')}>
            {a ? t('form.save') : opts.walkin ? t('form.checkIn') : t('form.book')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
