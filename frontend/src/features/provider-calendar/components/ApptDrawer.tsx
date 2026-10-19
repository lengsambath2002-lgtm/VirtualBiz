'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { formatPhone } from '@/lib/utils/phone';

import { ClientAvatar, SourceIcon, StatusPill } from '@/features/provider-shared/components/Bits';
import { PIcon, type PIconName } from '@/features/provider-shared/components/Icon';
import { CloseButton, Drawer } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useUi } from '@/features/provider-shared/store';
import {
  apptEnd,
  clientStats,
  conflicts,
  firstName,
  FLOW,
} from '@/features/provider-shared/util/logic';
import { fmtD, hm } from '@/features/provider-shared/util/time';

/** Appointment detail drawer with the status actions (prototype `openAppt`). */
export function ApptDrawer({ id }: { id: string }) {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const act = useActions();
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  // Clicking anywhere outside closes the More menu (prototype click handler).
  useEffect(() => {
    if (!more) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMore(false);
    };
    document.addEventListener('click', onDown);
    return () => document.removeEventListener('click', onDown);
  }, [more]);
  const a = d.appointments.find((x) => x.id === id);
  if (!a) return null;
  const c = d.clients.find((x) => x.id === a.clientId)!;
  const s = d.services.find((x) => x.id === a.serviceId);
  const st = d.staff.find((x) => x.id === a.staffId);
  const cs = clientStats(d, c.id);
  const cl = a.status === 'REQUESTED' ? conflicts(d, a) : [];
  const stepIdx = FLOW.indexOf(a.status);
  const price = f.money(a.price);
  const btn = (cls: string, label: ReactNode, onClick: () => void) => (
    <button type="button" className={k('btn', cls)} onClick={onClick}>
      {label}
    </button>
  );
  const sale = a.saleId;

  const primary: Record<string, ReactNode> = {
    REQUESTED: (
      <div className={k('r')}>
        {btn('btn-ghost', t('appt.decline'), () => void act.decline(a.id))}
        {btn('btn-primary', t('appt.accept'), () => void act.accept(a.id))}
      </div>
    ),
    BOOKED: (
      <div className={k('r')}>
        {btn('btn-ghost', t('appt.confirm'), () => act.setStatus(a.id, 'CONFIRMED'))}
        {btn('btn-primary', t('appt.arrived'), () => act.setStatus(a.id, 'ARRIVED'))}
      </div>
    ),
    CONFIRMED: (
      <div className={k('r')}>
        {btn('btn-primary', t('appt.arrived'), () => act.setStatus(a.id, 'ARRIVED'))}
      </div>
    ),
    ARRIVED: (
      <div className={k('r')}>
        {btn('btn-ghost', t('appt.start'), () => act.setStatus(a.id, 'STARTED'))}
        {btn('btn-primary', t('appt.checkout', { amount: price }), () =>
          ui.open({ t: 'checkout', id: a.id }),
        )}
      </div>
    ),
    STARTED: (
      <div className={k('r')}>
        {btn('btn-primary btn-lg', t('appt.checkout', { amount: price }), () =>
          ui.open({ t: 'checkout', id: a.id }),
        )}
      </div>
    ),
    COMPLETED: (
      <div className={k('r')}>
        {btn(
          'btn-ghost',
          t('appt.viewReceipt'),
          () => sale && ui.open({ t: 'receipt', saleId: sale }),
        )}
        {btn('btn-primary', t('appt.bookAgain'), () => act.rebook(a.id))}
      </div>
    ),
    NO_SHOW: (
      <div className={k('r')}>
        {btn('btn-ghost', t('appt.undoNoShow'), () => act.setStatus(a.id, 'BOOKED'))}
        {btn('btn-primary', t('appt.rebook'), () => act.rebook(a.id))}
      </div>
    ),
    CANCELLED: (
      <div className={k('r')}>{btn('btn-primary', t('appt.rebook'), () => act.rebook(a.id))}</div>
    ),
  };
  const moreItems: [string, PIconName, () => void, boolean?][] = [
    'BOOKED',
    'CONFIRMED',
    'ARRIVED',
    'REQUESTED',
  ].includes(a.status)
    ? [
        [t('appt.edit'), 'edit', () => ui.open({ t: 'apptForm', opts: { id: a.id } })],
        ...(a.status !== 'REQUESTED'
          ? ([
              [t('appt.markNoShow'), 'ban', () => act.noShow(a.id)],
              [t('appt.cancelAppt'), 'trash', () => void act.cancel(a.id), true],
            ] as [string, PIconName, () => void, boolean?][])
          : []),
      ]
    : [];

  return (
    <Drawer label={c.name}>
      <div className={k('dr-h')} style={{ boxShadow: `inset 4px 0 0 ${st?.color}` }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill status={a.status} />
            <span
              className={k('tiny muted')}
              style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}
            >
              <SourceIcon source={a.source} />
              {t(`source.${a.source}`)} · #{a.number}
            </span>
          </div>
          <h2 style={{ marginTop: 6 }} className={k('num')}>
            {fmtD(a.date, locale)}, {hm(a.start)}–{hm(apptEnd(a))}
          </h2>
          {stepIdx >= 0 && (
            <div className={k('steps')} aria-label={t('appt.progress')}>
              {FLOW.map((s2, i) => (
                <i key={s2} className={k(i <= stepIdx && 'on')} title={f.status(s2)} />
              ))}
            </div>
          )}
        </div>
        <CloseButton />
      </div>
      <div className={k('dr-b')}>
        {cl.length > 0 && (
          <div className={k('warnbox')}>
            {t.rich('appt.clashWarn', {
              list: f.conflicts(cl),
              name: firstName(st?.name ?? ''),
              b: (ch) => <b>{ch}</b>,
            })}
          </div>
        )}
        <div className={k('card')}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <ClientAvatar c={c} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <button
                type="button"
                className={k('link quiet')}
                style={{ fontWeight: 600, textDecoration: 'none', fontSize: 15 }}
                onClick={() => ui.open({ t: 'client', id: c.id })}
              >
                {c.name}
              </button>
              <div className={k('meta')}>
                <span className={k('num')}>{formatPhone(c.phone)}</span>
                <button
                  type="button"
                  className={k('link quiet tiny')}
                  onClick={() => void act.copy(formatPhone(c.phone))}
                >
                  {t('common.copy')}
                </button>
              </div>
            </div>
          </div>
          <div className={k('meta')}>
            {cs.visits ? (
              <>
                <span className={k('pill neutral')}>{t('appt.visits', { n: cs.visits })}</span>
                <span className={k('pill neutral')}>
                  {t('appt.spent', { amount: f.money0(cs.spend) })}
                </span>
              </>
            ) : (
              <span className={k('pill info')}>{t('appt.newClient')}</span>
            )}
            {cs.noshow > 0 && (
              <span className={k('pill bad')}>{t('appt.noShows', { n: cs.noshow })}</span>
            )}
          </div>
          {c.note && (
            <div className={k('warnbox')} style={{ padding: '8px 10px' }}>
              <PIcon name="note" size={14} /> {c.note}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className={k('sec-t')}>{t('appt.service')}</div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong style={{ fontWeight: 500 }}>{s?.name}</strong>
              <div className={k('meta')}>
                {t('appt.durWith', { dur: a.durationMin })}{' '}
                <span style={{ color: st?.color, fontWeight: 600 }}>{st?.name}</span>
              </div>
            </div>
            <strong className={k('num')}>{price}</strong>
          </div>
        </div>
        {a.note && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className={k('sec-t')}>{t('appt.bookingNote')}</div>
            <div className={k('card')} style={{ padding: 10 }}>
              {a.note}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          <div className={k('sec-t')}>{t('appt.activity')}</div>
          <div className={k('log')}>
            {[...a.log].reverse().map((l, i) => (
              <div key={i}>
                <i />
                <span>{f.log(l)}</span>
                <span className={k('num')}>{f.ago(l.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={k('dr-f')}>
        {primary[a.status] ?? null}
        {moreItems.length > 0 && (
          <div className={k('more')} ref={moreRef}>
            <button
              type="button"
              className={k('btn btn-ghost btn-block')}
              onClick={() => setMore((m) => !m)}
            >
              <PIcon name="more" size={18} />
              {t('appt.more')}
            </button>
            {more && (
              <div className={k('menu')}>
                {moreItems.map(([label, ic, fn, danger]) => (
                  <button key={label} type="button" className={k(danger && 'danger')} onClick={fn}>
                    <PIcon name={ic} size={18} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
