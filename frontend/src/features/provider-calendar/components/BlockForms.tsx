'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { BLOCK_REASONS, type BlockReason } from '@/lib/domain';

import { PIcon } from '@/features/provider-shared/components/Icon';
import { CloseButton, Drawer, Field, Modal } from '@/features/provider-shared/components/Overlay';
import { createBlock, deleteBlock } from '@/features/provider-shared/api';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import {
  apptEnd,
  clientStats,
  conflicts,
  firstName,
  pending,
} from '@/features/provider-shared/util/logic';
import { H0, H1, hm, isIsoDate, todayIso } from '@/features/provider-shared/util/time';

const STARTS = Array.from({ length: (H1 - H0) * 4 }, (_, i) => H0 * 60 + i * 15);
const DURS = [15, 30, 45, 60, 90, 120, 240];

/** Click on an empty slot in a staff column: new appointment or block. */
export function SlotChooser({
  staffId,
  date,
  start,
}: {
  staffId: string;
  date: string;
  start: number;
}) {
  const { t } = useFmt();
  const d = useData();
  const open = useUi((s) => s.open);
  return (
    <Modal>
      <h2>
        {hm(start)} · {d.staff.find((m) => m.id === staffId)?.name}
      </h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <button
          type="button"
          className={k('btn btn-primary btn-lg')}
          onClick={() => open({ t: 'apptForm', opts: { date, start, staffId } })}
        >
          <PIcon name="cal" size={18} />
          {t('calendar.slotNew')}
        </button>
        <button
          type="button"
          className={k('btn btn-ghost')}
          onClick={() => open({ t: 'block', date, start, staffId })}
        >
          <PIcon name="ban" size={18} />
          {t('calendar.slotBlock')}
        </button>
      </div>
    </Modal>
  );
}

/** Block time for a team member (prototype `blockForm`). */
export function BlockForm(p: { date?: string; start?: number; staffId?: string }) {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const search = useSearchParams();
  const qd = search.get('date');
  const [staffId, setStaffId] = useState(p.staffId ?? d.staff[0]?.id ?? '');
  const [date, setDate] = useState(p.date ?? (isIsoDate(qd) ? qd : todayIso()));
  const [start, setStart] = useState(p.start ?? 12 * 60);
  const [dur, setDur] = useState(60);
  const [reason, setReason] = useState<BlockReason>('LUNCH');

  const actions = useActions();
  const submit = async () => {
    const bid = d.business.id;
    let id: string;
    try {
      const b = await createBlock(bid, { staffId, date, start, durationMin: dur, reason });
      id = b.id;
      useProviderStore.getState().update((dd) => {
        dd.blocks.push(b);
      });
    } catch (e) {
      actions.fail(e);
      return;
    }
    ui.close(true);
    ui.showToast(
      t('block.toast', {
        from: hm(start),
        to: hm(start + dur),
        name: firstName(d.staff.find((m) => m.id === staffId)?.name ?? ''),
      }),
      {
        label: t('common.undo'),
        fn: () =>
          void deleteBlock(bid, id).then(
            () =>
              useProviderStore.getState().update((dd) => {
                dd.blocks = dd.blocks.filter((b) => b.id !== id);
              }),
            actions.fail,
          ),
      },
    );
  };

  return (
    <Modal>
      <h2>{t('block.title')}</h2>
      <p className={k('muted')}>{t('block.sub')}</p>
      <form
        className={k('form')}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={k('g2')}>
          <Field id="bs" label={t('block.staff')}>
            <select id="bs" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {d.staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="bdd" label={t('block.date')}>
            <input type="date" id="bdd" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div className={k('g3')}>
          <Field id="bt0" label={t('block.from')}>
            <select id="bt0" value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {STARTS.map((m) => (
                <option key={m} value={m}>
                  {hm(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="bdur" label={t('block.for')}>
            <select id="bdur" value={dur} onChange={(e) => setDur(Number(e.target.value))}>
              {DURS.map((x) => (
                <option key={x} value={x}>
                  {x < 60 ? t('time.min', { n: x }) : t('time.hours', { n: x / 60 })}
                </option>
              ))}
            </select>
          </Field>
          <Field id="brs" label={t('block.reason')}>
            <select
              id="brs"
              value={reason}
              onChange={(e) => setReason(e.target.value as BlockReason)}
            >
              {BLOCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`blockReason.${r}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className={k('btn btn-ghost')} onClick={() => ui.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={k('btn btn-primary')}>
            {t('block.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Online requests drawer (prototype `openRequests`). */
export function RequestsDrawer() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const act = useActions();
  const req = pending(d);
  const today = todayIso();
  return (
    <Drawer label={t('requests.title')}>
      <div className={k('dr-h')}>
        <div>
          <h2>{t('requests.title')}</h2>
          <p className={k('small muted')}>{t('requests.sub')}</p>
        </div>
        <CloseButton />
      </div>
      <div className={k('dr-b')} style={{ gap: 10 }}>
        {req.length ? (
          req.map((a) => {
            const c = d.clients.find((x) => x.id === a.clientId)!;
            const st = d.staff.find((x) => x.id === a.staffId);
            const s = d.services.find((x) => x.id === a.serviceId);
            const cl = conflicts(d, a);
            const visits = clientStats(d, c.id).visits;
            return (
              <div key={a.id} className={k('card')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <button
                      type="button"
                      className={k('link quiet')}
                      style={{ textDecoration: 'none', fontWeight: 600 }}
                      onClick={() => ui.open({ t: 'appt', id: a.id })}
                    >
                      {c.name}
                    </button>
                    <div className={k('meta num')}>
                      {s?.name} · {f.rel(a.date, today)} {hm(a.start)}–{hm(apptEnd(a))}
                    </div>
                    <div className={k('meta')}>
                      <span style={{ color: st?.color, fontWeight: 600 }}>●</span>
                      {t('requests.requested', { staff: st?.name ?? '', ago: f.ago(a.createdAt) })}
                    </div>
                  </div>
                  {visits ? (
                    <span className={k('pill neutral')}>{t('requests.visits', { n: visits })}</span>
                  ) : (
                    <span className={k('pill info')}>{t('requests.new')}</span>
                  )}
                </div>
                {a.note && <div className={k('small')}>“{a.note}”</div>}
                {cl.length > 0 && (
                  <div className={k('warnbox')} style={{ padding: '8px 10px' }}>
                    <PIcon name="alert" size={14} />{' '}
                    {t('requests.clash', { list: f.conflicts(cl) })}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    className={k('btn btn-ghost btn-sm')}
                    onClick={() => void act.decline(a.id)}
                  >
                    {t('appt.decline')}
                  </button>
                  <button
                    type="button"
                    className={k('btn btn-primary btn-sm')}
                    onClick={() => void act.accept(a.id)}
                  >
                    {t('appt.accept')}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={k('empty')}>
            <strong>{t('requests.empty')}</strong>
            <span>{t('requests.emptySub')}</span>
          </div>
        )}
      </div>
      <div />
    </Drawer>
  );
}
